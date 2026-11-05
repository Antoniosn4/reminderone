// =============================================================
//  vaultService.test.js
//  Ciclo de vida do cofre local: setup, unlock validado pelo
//  canary, backoff contra força bruta e destruição.
//
//  Usa o PBKDF2 real (600k iterações, ~0,4 s por derivação):
//  o objetivo é provar o comportamento de segurança, não simular.
//  Cenários de muitas falhas semeiam o contador no localStorage
//  em vez de derivar a chave N vezes.
// =============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    destroyVault,
    getLockoutDelayMs,
    isVaultInitialized,
    setupVault,
    unlockVault,
} from "../src/services/vaultService";
import { decryptObject, encryptObject } from "../src/services/cryptoService";

const PASSWORD = "1234-pin-correto";
const WRONG_PASSWORD = "0000-pin-errado";
const META_KEY = "reminder-vault-meta";
const ATTEMPTS_KEY = "reminder-vault-attempts";
const NOW = new Date("2026-01-01T12:00:00Z").getTime();

function seedFailedAttempts(count, lastFailedAt = NOW) {
    localStorage.setItem(ATTEMPTS_KEY, JSON.stringify({ count, lastFailedAt }));
}

beforeEach(() => {
    localStorage.clear();
    // Só o relógio é falso: as Promises do WebCrypto continuam reais.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
});

afterEach(() => {
    vi.useRealTimers();
});

describe("vaultService — setup", () => {
    it("marca o cofre como inicializado e persiste salt e canary, nunca a senha", async () => {
        expect(isVaultInitialized()).toBe(false);
        await setupVault(PASSWORD);
        expect(isVaultInitialized()).toBe(true);
        const raw = localStorage.getItem(META_KEY);
        expect(raw).not.toContain(PASSWORD);
        expect(JSON.parse(raw)).toMatchObject({ salt: expect.any(String), canary: { v: 1 }, createdAt: NOW });
    });

    it("gera um salt novo a cada setup", async () => {
        await setupVault(PASSWORD);
        const firstSalt = JSON.parse(localStorage.getItem(META_KEY)).salt;
        await setupVault(PASSWORD);
        expect(JSON.parse(localStorage.getItem(META_KEY)).salt).not.toBe(firstSalt);
    });

    it("zera tentativas falhas anteriores", async () => {
        seedFailedAttempts(3);
        await setupVault(PASSWORD);
        expect(getLockoutDelayMs()).toBe(0);
    });
});

describe("vaultService — unlock", () => {
    it("recusa destravar um cofre que não existe", async () => {
        await expect(unlockVault(PASSWORD)).rejects.toThrow("Vault não inicializado");
    });

    it("com a senha correta devolve a mesma chave do setup", async () => {
        const setupKey = await setupVault(PASSWORD);
        const payload = await encryptObject(setupKey, { title: "Privado" });
        const unlockedKey = await unlockVault(PASSWORD);
        await expect(decryptObject(unlockedKey, payload)).resolves.toEqual({ title: "Privado" });
    });

    it("com a senha errada devolve null e inicia o backoff de 1 s", async () => {
        await setupVault(PASSWORD);
        await expect(unlockVault(WRONG_PASSWORD)).resolves.toBeNull();
        expect(getLockoutDelayMs()).toBe(1_000);
    });

    it("durante o backoff lança LOCKED_OUT sem contar nova tentativa", async () => {
        await setupVault(PASSWORD);
        seedFailedAttempts(2);
        vi.setSystemTime(NOW + 500);
        const error = await unlockVault(PASSWORD).catch((e) => e);
        expect(error).toMatchObject({ code: "LOCKED_OUT", retryInMs: 1_500 });
        expect(JSON.parse(localStorage.getItem(ATTEMPTS_KEY)).count).toBe(2);
    });

    it("depois do backoff aceita a senha correta e zera as tentativas", async () => {
        await setupVault(PASSWORD);
        seedFailedAttempts(2);
        vi.setSystemTime(NOW + 2_000);
        await expect(unlockVault(PASSWORD)).resolves.not.toBeNull();
        expect(localStorage.getItem(ATTEMPTS_KEY)).toBeNull();
    });

    it("rejeita um canary adulterado como senha errada", async () => {
        await setupVault(PASSWORD);
        const meta = JSON.parse(localStorage.getItem(META_KEY));
        localStorage.setItem(META_KEY, JSON.stringify({ ...meta, canary: { ...meta.canary, data: btoa("adulterado") } }));
        await expect(unlockVault(PASSWORD)).resolves.toBeNull();
    });
});

describe("vaultService — backoff", () => {
    it.each([
        [1, 1_000],
        [2, 2_000],
        [3, 5_000],
        [4, 10_000],
        [5, 30_000],
        [50, 30_000],
    ])("após %i falhas exige %i ms de espera (teto de 30 s)", (count, delay) => {
        seedFailedAttempts(count);
        expect(getLockoutDelayMs()).toBe(delay);
    });

    it("desconta o tempo já decorrido desde a última falha", () => {
        seedFailedAttempts(3);
        vi.setSystemTime(NOW + 4_000);
        expect(getLockoutDelayMs()).toBe(1_000);
        vi.setSystemTime(NOW + 6_000);
        expect(getLockoutDelayMs()).toBe(0);
    });

    it("trata contador corrompido como zero tentativas", () => {
        localStorage.setItem(ATTEMPTS_KEY, "{não é json");
        expect(getLockoutDelayMs()).toBe(0);
    });
});

describe("vaultService — destroyVault", () => {
    it("apaga a meta e o contador de tentativas", async () => {
        await setupVault(PASSWORD);
        seedFailedAttempts(4);
        destroyVault();
        expect(isVaultInitialized()).toBe(false);
        expect(localStorage.getItem(ATTEMPTS_KEY)).toBeNull();
    });
});
