// =============================================================
//  useVoiceRecording.test.jsx
//  A voz do desktop usa o Whisper local sempre que dá para gravar,
//  mesmo com a Web Speech API disponível (WebView2 e Chrome têm as
//  duas). A Web Speech API manda o áudio para a nuvem do navegador.
// =============================================================

import { describe, it, expect, vi, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { detectVoiceStrategy } from "../src/hooks/useVoiceRecording";

const recordingWindow = () => ({
    navigator: { mediaDevices: { getUserMedia: async () => ({}) } },
    MediaRecorder: class {},
});

describe("detectVoiceStrategy", () => {
    it("prefere o Whisper quando dá para gravar, mesmo com a Web Speech API", () => {
        expect(detectVoiceStrategy({ ...recordingWindow(), webkitSpeechRecognition: class {} })).toBe("whisper");
    });

    it("usa a Web Speech API só quando não dá para gravar", () => {
        expect(detectVoiceStrategy({ navigator: {}, webkitSpeechRecognition: class {} })).toBe("speech");
    });

    it("sem gravação nem Web Speech API, não há voz", () => {
        expect(detectVoiceStrategy({ navigator: {} })).toBeNull();
        expect(detectVoiceStrategy(undefined)).toBeNull();
    });
});

class FakeRecorder extends EventTarget {
    constructor(stream) {
        super();
        this.stream = stream;
        this.state = "inactive";
    }
    start() {
        this.state = "recording";
    }
    stop() {
        this.state = "inactive";
        this.dispatchEvent(Object.assign(new Event("dataavailable"), { data: new Blob(["áudio"]) }));
        this.dispatchEvent(new Event("stop"));
    }
}

afterEach(() => {
    vi.unstubAllGlobals();
    vi.doUnmock("../src/services/whisperService");
    vi.resetModules();
});

describe("useVoiceRecording", () => {
    it("grava com o MediaRecorder e transcreve pelo Whisper local", async () => {
        const speech = vi.fn();
        const track = { stop: vi.fn() };
        vi.stubGlobal("MediaRecorder", FakeRecorder);
        vi.stubGlobal("webkitSpeechRecognition", speech);
        Object.defineProperty(navigator, "mediaDevices", {
            configurable: true,
            value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [track] })) },
        });
        const transcribeAudio = vi.fn(async () => "Pagar o boleto amanhã");
        vi.doMock("../src/services/whisperService", () => ({ transcribeAudio }));
        vi.resetModules();
        const { useVoiceRecording, VOICE_STRATEGY } = await import("../src/hooks/useVoiceRecording");
        expect(VOICE_STRATEGY).toBe("whisper");

        const setInputValue = vi.fn();
        const onTranscribed = vi.fn();
        const { result } = renderHook(() => useVoiceRecording(setInputValue, onTranscribed));

        await act(async () => result.current.toggleRecording());
        await waitFor(() => expect(result.current.isRecording).toBe(true));
        await act(async () => result.current.toggleRecording());

        await waitFor(() => expect(onTranscribed).toHaveBeenCalledWith("Pagar o boleto amanhã"));
        expect(setInputValue).toHaveBeenCalledWith("Pagar o boleto amanhã");
        expect(transcribeAudio).toHaveBeenCalledTimes(1);
        expect(transcribeAudio.mock.calls[0][0]).toBeInstanceOf(Blob);
        expect(speech).not.toHaveBeenCalled();
        expect(track.stop).toHaveBeenCalled();
    });
});
