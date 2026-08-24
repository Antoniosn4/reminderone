// =============================================================
//  cryptoService.test.js
//  Garante que o pipeline de cifragem mantém integridade,
//  confidencialidade e detecção de adulteração (AES-GCM).
// =============================================================

import { describe, it, expect } from "vitest";
import {
    deriveKeyFromPassword,
    encryptObject,
    decryptObject,
    generateSalt,
} from "../src/services/cryptoService";

const PASSWORD = "senha-mestre-correta-horse-battery-staple";

async function freshKey() {
    const salt = generateSalt();
    return { key: await deriveKeyFromPassword(PASSWORD, salt), salt };
}

describe("cryptoService", () => {
    it("deriva uma chave determinística para o mesmo salt e senha", async () => {
        const salt = generateSalt();
        const k1 = await deriveKeyFromPassword(PASSWORD, salt);
        const k2 = await deriveKeyFromPassword(PASSWORD, salt);

        const payload = await encryptObject(k1, { msg: "ok" });
        const decrypted = await decryptObject(k2, payload);
        expect(decrypted).toEqual({ msg: "ok" });
    });

    it("ida e volta preserva o objeto original", async () => {
        const { key } = await freshKey();
        const original = { tasks: [1, 2, 3], meta: { version: 2 } };
        const payload = await encryptObject(key, original);
        const recovered = await decryptObject(key, payload);
        expect(recovered).toEqual(original);
    });

    it("gera IV diferente para cada cifragem (não-determinismo)", async () => {
        const { key } = await freshKey();
        const a = await encryptObject(key, { v: 1 });
        const b = await encryptObject(key, { v: 1 });
        expect(a.iv).not.toEqual(b.iv);
        expect(a.data).not.toEqual(b.data);
    });

    it("rejeita decifragem com chave errada", async () => {
        const salt = generateSalt();
        const correctKey = await deriveKeyFromPassword(PASSWORD, salt);
        const wrongKey = await deriveKeyFromPassword("senha-errada", salt);

        const payload = await encryptObject(correctKey, { msg: "secret" });
        await expect(decryptObject(wrongKey, payload)).rejects.toBeDefined();
    });

    it("detecta adulteração no ciphertext (AES-GCM tag)", async () => {
        const { key } = await freshKey();
        const payload = await encryptObject(key, { msg: "intacto" });
        const tampered = { ...payload, data: payload.data.replace(/.$/, "A") };
        await expect(decryptObject(key, tampered)).rejects.toBeDefined();
    });

    it("rejeita payload sem versão suportada", async () => {
        const { key } = await freshKey();
        await expect(decryptObject(key, { v: 999, iv: "x", data: "y" }))
            .rejects.toThrow(/vers/i);
    });
});
