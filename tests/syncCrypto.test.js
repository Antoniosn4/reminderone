// =============================================================
//  syncCrypto.test.js
//  O desktop cifra exatamente como o celular: mesmo vetor conhecido
//  do teste do mobile (src/services/__tests__/syncEngine.test.ts) e
//  mesmo token que o servidor confere (server/tests/test_sync.py).
// =============================================================

import { describe, it, expect } from "vitest";
import {
    aadFor,
    authHashFor,
    createSyncCipher,
    deriveAuthToken,
    formatPairingCode,
    generateSyncKeyHex,
    parsePairingCode,
} from "../src/data/syncCrypto";

const KEY_HEX = "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";
const VECTOR = {
    aad: "task|t1|2026-10-11T12:00:00.000Z|0",
    plaintext: '{"title":"Olá, sincronia"}',
    payload: "v1.AAECAwQFBgcICQoL.PCCicrGJpzm3Y9jnckhUTfC/6VeCFDEVWUWYDjNcfSkckRNZoaEUGIvXVg==",
};

describe("cifra do protocolo", () => {
    it("bate com o vetor conhecido (o mesmo do mobile)", async () => {
        const cipher = await createSyncCipher(KEY_HEX, () => Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]));
        expect(await cipher.encrypt(VECTOR.aad, VECTOR.plaintext)).toBe(VECTOR.payload);
        expect(await cipher.decrypt(VECTOR.aad, VECTOR.payload)).toBe(VECTOR.plaintext);
    });

    it("não decifra se o registro, a versão ou a lápide forem trocados", async () => {
        const cipher = await createSyncCipher(KEY_HEX);
        expect(await cipher.decrypt("task|t1|2026-10-11T12:00:00.000Z|1", VECTOR.payload)).toBeNull();
        expect(await cipher.decrypt("task|t1|2026-10-11T12:00:01.000Z|0", VECTOR.payload)).toBeNull();
    });

    it("monta o AAD como o protocolo", () => {
        expect(aadFor({ entity: "note", id: "n1", updatedAt: "2026-10-11T12:00:00.000Z", deleted: true }))
            .toBe("note|n1|2026-10-11T12:00:00.000Z|1");
    });
});

describe("token e pareamento", () => {
    it("deriva o mesmo token que o mobile e o servidor", async () => {
        expect(await deriveAuthToken(KEY_HEX)).toBe("68ed4c72ed85fb637f2a3dfe95612dd40423abf464b3879b80303606379e62cc");
        expect(await authHashFor(KEY_HEX)).toMatch(/^[0-9a-f]{64}$/);
    });

    it("gera chaves de 256 bits", () => {
        const key = generateSyncKeyHex();
        expect(key).toMatch(/^[0-9a-f]{64}$/);
        expect(generateSyncKeyHex()).not.toBe(key);
    });

    it("código de pareamento: ida e volta", () => {
        const code = formatPairingCode({ keyHex: KEY_HEX, url: "http://192.168.1.5:8000" });
        expect(code).toBe(`reminder-sync:v1:${KEY_HEX}:http://192.168.1.5:8000`);
        expect(parsePairingCode(` ${code}/ `)).toEqual({ keyHex: KEY_HEX, url: "http://192.168.1.5:8000" });
        expect(parsePairingCode("qualquer coisa")).toBeNull();
        expect(parsePairingCode("reminder-sync:v1:abc:http://x")).toBeNull();
    });
});
