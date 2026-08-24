// =============================================================
//  tests/setup.js
//  Configuração global do ambiente de testes (jsdom).
//  Carrega matchers do @testing-library/jest-dom e expõe um
//  WebCrypto SubtleCrypto compatível com node:crypto para que
//  cryptoService.js funcione fora do browser.
// =============================================================

import "@testing-library/jest-dom/vitest";
import { webcrypto } from "node:crypto";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// jsdom não traz crypto.subtle por padrão; o módulo `webcrypto` é
// API-compatível com o WebCrypto do browser.
if (typeof globalThis.crypto === "undefined" || !globalThis.crypto.subtle) {
    Object.defineProperty(globalThis, "crypto", {
        value: webcrypto,
        configurable: true,
    });
}

afterEach(() => {
    cleanup();
});
