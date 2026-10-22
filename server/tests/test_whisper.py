"""Cobre a escolha de GPU/CPU do Whisper e a volta para a CPU quando a GPU falha.
O torch e o faster_whisper são trocados por módulos falsos: nada é baixado."""

import sys
import types

import pytest

from routers import whisper


def fake_torch(*, cuda: bool) -> types.ModuleType:
    """torch mínimo. A propriedade é `total_memory`, como no PyTorch de verdade."""
    module = types.ModuleType("torch")
    module.cuda = types.SimpleNamespace(
        is_available=lambda: cuda,
        get_device_name=lambda _index: "GPU de teste",
        get_device_properties=lambda _index: types.SimpleNamespace(total_memory=8 * 1024**3),
    )
    return module


def fake_faster_whisper(*, gpu_fails: bool, created: list) -> types.ModuleType:
    module = types.ModuleType("faster_whisper")

    class WhisperModel:
        def __init__(self, *, model_size_or_path, device, compute_type, cpu_threads):
            if gpu_fails and device == "cuda":
                raise RuntimeError("Library cublas64_12.dll is not found")
            created.append((device, compute_type))

    module.WhisperModel = WhisperModel
    return module


@pytest.fixture(autouse=True)
def fresh_model(monkeypatch):
    monkeypatch.setattr(whisper, "_model", None)
    monkeypatch.setattr(whisper, "_model_device", "cpu")
    monkeypatch.delenv("WHISPER_DEVICE", raising=False)


def test_usa_a_gpu_quando_o_torch_ve_cuda(monkeypatch):
    monkeypatch.setitem(sys.modules, "torch", fake_torch(cuda=True))

    assert whisper._resolve_device() == ("cuda", "float16")


def test_sem_cuda_usa_cpu(monkeypatch):
    monkeypatch.setitem(sys.modules, "torch", fake_torch(cuda=False))

    assert whisper._resolve_device() == ("cpu", "int8")


def test_whisper_device_cpu_ignora_a_gpu(monkeypatch):
    monkeypatch.setitem(sys.modules, "torch", fake_torch(cuda=True))
    monkeypatch.setenv("WHISPER_DEVICE", "cpu")

    assert whisper._resolve_device() == ("cpu", "int8")


def test_se_a_gpu_falha_ao_carregar_o_modelo_volta_para_a_cpu(monkeypatch):
    created = []
    monkeypatch.setitem(sys.modules, "torch", fake_torch(cuda=True))
    monkeypatch.setitem(sys.modules, "faster_whisper", fake_faster_whisper(gpu_fails=True, created=created))

    assert whisper._get_model() is not None
    assert created == [("cpu", "int8")]
    assert whisper._model_device == "cpu"


def test_gpu_que_carrega_fica_na_gpu(monkeypatch):
    created = []
    monkeypatch.setitem(sys.modules, "torch", fake_torch(cuda=True))
    monkeypatch.setitem(sys.modules, "faster_whisper", fake_faster_whisper(gpu_fails=False, created=created))

    whisper._get_model()

    assert created == [("cuda", "float16")]
    assert whisper._model_device == "cuda"
