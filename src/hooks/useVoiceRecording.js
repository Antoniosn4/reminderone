// =============================================================
//  useVoiceRecording.js
//  Gravação e transcrição de voz com duas estratégias:
//
//  1. Faster-Whisper local (primária) — o áudio vai só para o
//     servidor deste computador (a sidecar), sem nuvem, como pede
//     a proposta local-first. O mesmo Whisper atende o celular.
//
//  2. Web Speech API (fallback) — só quando o runtime não consegue
//     gravar áudio. Ela manda o áudio para o serviço online do
//     navegador.
//
//  Fluxo Whisper:
//    clica mic → MediaRecorder grava → clica ✔️ → blob → sidecar → texto
//
//  Fluxo Web Speech API (fallback):
//    clica mic → reconhecimento em tempo real → texto aparece live
//    clica ✔️ → recognition.stop() → commit do resultado final
//    clica ❌ → recognition.abort() → descarta tudo
// =============================================================

import { useState, useRef, useCallback, useEffect } from "react";
import toast from "react-hot-toast";
import { transcribeAudio } from "../services/whisperService";
import { logger } from "../utils/logger";

/**
 * Qual estratégia de voz o runtime permite: "whisper" se dá para gravar
 * áudio, senão "speech" se houver Web Speech API, senão null (sem voz).
 */
export function detectVoiceStrategy(win = typeof window !== "undefined" ? window : undefined) {
    if (!win) return null;
    const canRecord =
        typeof win.navigator?.mediaDevices?.getUserMedia === "function" &&
        typeof win.MediaRecorder !== "undefined";
    if (canRecord) return "whisper";
    if (win.SpeechRecognition || win.webkitSpeechRecognition) return "speech";
    return null;
}

/** Estratégia do runtime atual; o SmartInput usa a mesma para os rótulos. */
export const VOICE_STRATEGY = detectVoiceStrategy();

const SpeechRecognitionAPI =
    VOICE_STRATEGY === "speech" ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;

export function useVoiceRecording(setInputValue, onTranscribed) {
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [mediaStream, setMediaStream] = useState(null);

    // Refs Web Speech API
    const recognitionRef = useRef(null);
    const finalTranscriptRef = useRef("");
    const cancelledRef = useRef(false);

    // Refs Whisper fallback
    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);

    const timerRef = useRef(null);
    const onTranscribedRef = useRef(onTranscribed);
    useEffect(() => { onTranscribedRef.current = onTranscribed; }, [onTranscribed]);

    // ── Timer ─────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (isRecording) {
            setElapsedTime(0);
            timerRef.current = setInterval(() => setElapsedTime((p) => p + 1), 1000);
        } else {
            clearInterval(timerRef.current);
        }
        return () => clearInterval(timerRef.current);
    }, [isRecording]);

    // ── Cleanup comum ─────────────────────────────────────────────────────────
    const _releaseStream = useCallback((stream) => {
        stream?.getTracks().forEach((t) => t.stop());
    }, []);

    // =========================================================================
    // ESTRATÉGIA 2 (fallback): Web Speech API
    // =========================================================================

    const _startSpeechRecognition = useCallback(async () => {
        cancelledRef.current = false;
        finalTranscriptRef.current = "";

        // Pede acesso ao mic simultaneamente para o waveform visual.
        // O SpeechRecognition já faz isso internamente — aqui só queremos a stream.
        let stream = null;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setMediaStream(stream);
        } catch {
            // Microfone indisponível para waveform — prossegue sem visualização
        }

        const recognition = new SpeechRecognitionAPI();
        recognition.lang = "pt-BR";
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event) => {
            let final = finalTranscriptRef.current;
            let interim = "";

            for (let i = event.resultIndex; i < event.results.length; i++) {
                if (event.results[i].isFinal) {
                    final += event.results[i][0].transcript + " ";
                } else {
                    interim = event.results[i][0].transcript;
                }
            }

            finalTranscriptRef.current = final;
            // Mostra resultado em tempo real no input
            setInputValue((final + interim).trimEnd());
        };

        recognition.onerror = (event) => {
            if (cancelledRef.current || event.error === "aborted") return;

            if (event.error === "no-speech") {
                // Silêncio prolongado — reinicia automaticamente
                return;
            }

            if (event.error === "network") {
                toast.error("Reconhecimento de voz requer conexão com a internet.");
            } else if (event.error === "not-allowed") {
                toast.error("Permissão de microfone negada. Verifique as configurações.");
            } else {
                logger.warn("[SpeechRecognition] Erro:", event.error);
            }

            _releaseStream(stream);
            setMediaStream(null);
            setIsRecording(false);
            setElapsedTime(0);
        };

        recognition.onend = () => {
            _releaseStream(stream);
            setMediaStream(null);
            setIsRecording(false);
            setElapsedTime(0);

            if (cancelledRef.current) {
                setInputValue("");
                return;
            }

            const text = finalTranscriptRef.current.trim();
            if (text) {
                setInputValue(text);
                onTranscribedRef.current?.(text);
            }
        };

        recognitionRef.current = recognition;
        recognition.start();
        setIsRecording(true);
    }, [setInputValue, _releaseStream]);

    const _stopSpeechRecognition = useCallback(() => {
        recognitionRef.current?.stop();
        recognitionRef.current = null;
        // onend do recognition faz o resto
    }, []);

    const _cancelSpeechRecognition = useCallback(() => {
        cancelledRef.current = true;
        recognitionRef.current?.abort();
        recognitionRef.current = null;
        finalTranscriptRef.current = "";
        setInputValue("");
        setIsRecording(false);
        setElapsedTime(0);
    }, [setInputValue]);

    // =========================================================================
    // ESTRATÉGIA 1: Whisper local
    // =========================================================================

    const _stopAndTranscribeWhisper = useCallback(async () => {
        const recorder = mediaRecorderRef.current;
        if (!recorder || recorder.state === "inactive") return;

        cancelledRef.current = false;

        await new Promise((resolve) => {
            recorder.addEventListener("stop", resolve, { once: true });
            recorder.stop();
        });

        if (recorder.stream) recorder.stream.getTracks().forEach((t) => t.stop());

        if (cancelledRef.current) return;

        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        chunksRef.current = [];
        mediaRecorderRef.current = null;
        setMediaStream(null);
        setIsRecording(false);
        setIsTranscribing(true);

        const text = await transcribeAudio(blob);
        setIsTranscribing(false);

        if (text === null) {
            toast.error("Falha na transcrição. Servidor local indisponível.");
            return;
        }
        if (text.trim()) {
            setInputValue(text);
            onTranscribedRef.current?.(text);
        } else {
            toast.error("Não deu para entender o áudio. Fale mais perto do microfone e tente de novo.");
        }
    }, [setInputValue]);

    const _startWhisperRecording = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);

            chunksRef.current = [];
            cancelledRef.current = false;
            recorder.addEventListener("dataavailable", (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            });

            recorder.start();
            mediaRecorderRef.current = recorder;
            setMediaStream(stream);
            setIsRecording(true);
        } catch {
            toast.error("Permissão de microfone negada. Verifique as configurações.");
        }
    }, []);

    const _cancelWhisperRecording = useCallback(() => {
        const recorder = mediaRecorderRef.current;
        if (!recorder) return;

        cancelledRef.current = true;
        recorder.addEventListener("stop", () => {
            chunksRef.current = [];
            mediaRecorderRef.current = null;
        }, { once: true });
        recorder.stop();
        if (recorder.stream) recorder.stream.getTracks().forEach((t) => t.stop());

        setIsRecording(false);
        setElapsedTime(0);
        setMediaStream(null);
    }, []);

    // =========================================================================
    // API pública — escolhe estratégia automaticamente
    // =========================================================================

    const toggleRecording = useCallback(() => {
        if (!VOICE_STRATEGY) return;
        const useSpeech = VOICE_STRATEGY === "speech";

        if (isRecording) {
            if (useSpeech) {
                _stopSpeechRecognition();
            } else {
                _stopAndTranscribeWhisper();
            }
            return;
        }

        if (useSpeech) {
            _startSpeechRecognition();
        } else {
            _startWhisperRecording();
        }
    }, [
        isRecording,
        _startSpeechRecognition, _stopSpeechRecognition,
        _startWhisperRecording, _stopAndTranscribeWhisper,
    ]);

    const cancelRecording = useCallback(() => {
        if (VOICE_STRATEGY === "speech" && isRecording) {
            _cancelSpeechRecognition();
        } else {
            _cancelWhisperRecording();
        }
    }, [isRecording, _cancelSpeechRecognition, _cancelWhisperRecording]);

    return { isRecording, isTranscribing, elapsedTime, toggleRecording, cancelRecording, mediaStream };
}
