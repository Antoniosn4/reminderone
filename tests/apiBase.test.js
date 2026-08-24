import { afterEach, describe, expect, it } from "vitest";
import { apiUrl, isTauriRuntime } from "../src/services/apiBase";

afterEach(() => {
    delete window.__TAURI_INTERNALS__;
    delete window.__TAURI__;
});

describe("apiBase", () => {
    it("usa caminho relativo no browser comum", () => {
        expect(isTauriRuntime()).toBe(false);
        expect(apiUrl("/api/gemini")).toBe("/api/gemini");
    });

    it("usa o sidecar local no runtime Tauri", () => {
        Object.defineProperty(window, "__TAURI_INTERNALS__", {
            value: {},
            configurable: true,
        });

        expect(isTauriRuntime()).toBe(true);
        expect(apiUrl("/api/gemini")).toBe("http://127.0.0.1:8000/api/gemini");
    });
});
