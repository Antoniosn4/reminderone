from __future__ import annotations

# =============================================================
#  routers/whisper.py
#  Endpoint de transcrição de áudio via Faster-Whisper (local/offline).
#
#  Arquitetura:
#    - Lazy Singleton: o modelo é carregado na primeira transcrição,
#      NÃO no boot do uvicorn. A GPU só é ocupada sob demanda.
#    - CUDA float16: otimizado para RTX 4060 (8 GB VRAM).
#    - Idioma fixo "pt": elimina alucinações e traduções espúrias.
#    - VAD filter: ignora silêncios e chiados antes de transcrever.
#
#  Configuração via variáveis de ambiente:
#    WHISPER_MODEL      → tamanho do modelo (default: "medium")
#    WHISPER_DEVICE     → "cuda" | "cpu" | "auto" (default: "auto")
#    WHISPER_LANGUAGE   → código ISO 639-1 (default: "pt")
#    WHISPER_BEAM_SIZE  → beam search width (default: 5)
# =============================================================

import os
import time
import tempfile
import logging
from threading import Lock
from typing import TYPE_CHECKING

from fastapi import APIRouter, HTTPException, UploadFile, File, Request

from middleware.rate_limit import SlidingWindowRateLimiter

if TYPE_CHECKING:
    from faster_whisper import WhisperModel

logger = logging.getLogger(__name__)

router = APIRouter()

# ── Configuração ──────────────────────────────────────────────

WHISPER_MODEL_SIZE = os.getenv("WHISPER_MODEL", "medium")
WHISPER_LANGUAGE = os.getenv("WHISPER_LANGUAGE", "pt")
WHISPER_BEAM_SIZE = int(os.getenv("WHISPER_BEAM_SIZE", "5"))

MAX_AUDIO_BYTES = 10 * 1024 * 1024  # 10 MB
WHISPER_RATE_LIMIT = 10
WHISPER_WINDOW_SEC = 60

# MIME types aceitos para upload de áudio.
# Bloqueia envio de arquivos não-áudio (ex: executáveis, imagens).
ALLOWED_AUDIO_TYPES = frozenset({
    "audio/webm", "audio/wav", "audio/wave", "audio/x-wav",
    "audio/mp3", "audio/mpeg", "audio/ogg", "audio/flac",
    "audio/mp4", "audio/m4a", "audio/x-m4a",
    "application/octet-stream",  # fallback — browsers às vezes enviam isso
})

_whisper_limiter = SlidingWindowRateLimiter(
    limit=WHISPER_RATE_LIMIT,
    window_sec=WHISPER_WINDOW_SEC,
)


# ── Detecção de hardware ──────────────────────────────────────

def _resolve_device() -> tuple[str, str]:
    """
    Determina device e compute_type.
    Respeita WHISPER_DEVICE se definido; caso contrário, auto-detecta.

    - GPU CUDA disponível → ("cuda", "float16")   — ideal RTX 4060 8 GB
    - Fallback CPU        → ("cpu",  "int8")       — sem GPU
    """
    env_device = os.getenv("WHISPER_DEVICE", "auto").lower().strip()

    if env_device == "cpu":
        logger.info("[Whisper] Forçado para CPU via WHISPER_DEVICE")
        return "cpu", "int8"

    if env_device in ("cuda", "auto"):
        try:
            import torch
            if torch.cuda.is_available():
                gpu_name = torch.cuda.get_device_name(0)
                vram_mb = torch.cuda.get_device_properties(0).total_memory // (1024 * 1024)
                logger.info(
                    "[Whisper] GPU detectada: %s (%d MB VRAM) — usando CUDA float16",
                    gpu_name, vram_mb,
                )
                return "cuda", "float16"
            else:
                logger.info("[Whisper] CUDA indisponível — fallback para CPU")
        except ImportError:
            logger.debug("[Whisper] torch não instalado — fallback para CPU")
        except Exception as exc:
            logger.warning("[Whisper] Falha na detecção GPU: %s — fallback para CPU", exc)

    logger.info("[Whisper] Modo CPU — usando int8")
    return "cpu", "int8"


# ── Lazy Singleton do modelo ──────────────────────────────────
#
# O modelo NÃO é carregado no boot do servidor. A primeira chamada
# a _get_model() faz o carregamento (3-5 s para 'medium' em CUDA).
# Chamadas seguintes reutilizam a mesma instância. Thread-safe via Lock.

_model: WhisperModel | None = None
_model_device: str = "cpu"
_model_lock = Lock()


def _get_model() -> "WhisperModel":
    """Lazy-load do Faster-Whisper. Thread-safe, carrega uma única vez."""
    global _model, _model_device

    if _model is not None:
        return _model

    with _model_lock:
        # Double-checked locking
        if _model is not None:
            return _model

        from faster_whisper import WhisperModel

        device, compute_type = _resolve_device()
        _model_device = device

        t0 = time.perf_counter()
        logger.info(
            "[Whisper] Carregando modelo '%s' (device=%s, compute_type=%s)...",
            WHISPER_MODEL_SIZE, device, compute_type,
        )

        try:
            _model = WhisperModel(
                model_size_or_path=WHISPER_MODEL_SIZE,
                device=device,
                compute_type=compute_type,
                cpu_threads=os.cpu_count() or 4,
            )
        except Exception as exc:
            if device == "cpu":
                raise
            # Ex.: CUDA visível pelo torch, mas sem as DLLs que o CTranslate2 usa.
            logger.warning("[Whisper] Falha ao carregar na GPU: %s — usando CPU", exc)
            device, compute_type = "cpu", "int8"
            _model_device = device
            _model = WhisperModel(
                model_size_or_path=WHISPER_MODEL_SIZE,
                device=device,
                compute_type=compute_type,
                cpu_threads=os.cpu_count() or 4,
            )

        elapsed = time.perf_counter() - t0
        logger.info("[Whisper] Modelo carregado em %.1fs", elapsed)

        return _model


def _client_id(request: Request) -> str:
    return request.client.host if request.client else "unknown"


# ── Rota ──────────────────────────────────────────────────────

@router.post("/whisper")
async def transcribe_audio(request: Request, file: UploadFile = File(...)):
    """
    Recebe um blob de áudio (webm, wav, mp3…) e retorna o texto transcrito.

    Pipeline:
      1. Rate limit por IP
      2. Validação de tamanho (max 10 MB)
      3. Salva em arquivo temporário (Whisper precisa de path no disco)
      4. Lazy-load do modelo (primeira vez ≈ 3-5 s)
      5. Transcreve com language="pt", VAD filter e beam search
      6. Limpa o arquivo temporário
    """
    _whisper_limiter.check(_client_id(request))

    # ── 0. Validar content-type ──
    content_type = (file.content_type or "").lower().split(";")[0].strip()
    if content_type and content_type not in ALLOWED_AUDIO_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Tipo de arquivo não suportado: '{content_type}'. Envie um arquivo de áudio.",
        )

    original_name = file.filename or "audio.webm"
    suffix = os.path.splitext(original_name)[1] or ".webm"

    tmp_path: str | None = None
    try:
        # ── 1. Ler e validar tamanho ──
        content = await file.read()
        if len(content) > MAX_AUDIO_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"Áudio muito grande: máximo {MAX_AUDIO_BYTES // (1024 * 1024)} MB.",
            )

        if len(content) == 0:
            raise HTTPException(status_code=400, detail="Arquivo de áudio vazio.")

        # ── 2. Salvar em disco ──
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        # ── 3. Transcrever ──
        model = _get_model()
        t0 = time.perf_counter()

        segments, info = model.transcribe(
            tmp_path,
            language=WHISPER_LANGUAGE,       # Força PT — elimina alucinações
            beam_size=WHISPER_BEAM_SIZE,
            vad_filter=True,                 # Ignora silêncio/chiado
            vad_parameters=dict(
                min_silence_duration_ms=500,  # Pausa mínima para cortar
                speech_pad_ms=200,            # Padding ao redor da fala
            ),
        )

        text = " ".join(seg.text for seg in segments).strip()
        elapsed = time.perf_counter() - t0

        logger.info(
            "[Whisper] Transcrição: %d chars em %.1fs (device=%s, lang=%s)",
            len(text), elapsed, _model_device, info.language,
        )

        return {
            "text": text,
            "device": _model_device,
            "language": info.language,
            "duration_sec": round(info.duration, 1),
            "processing_sec": round(elapsed, 1),
        }

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("[Whisper] Falha na transcrição: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Falha na transcrição do áudio: {str(exc)}",
        )
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
