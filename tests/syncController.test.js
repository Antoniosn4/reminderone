// =============================================================
//  syncController.test.js
//  Ativar, entrar com o código de outro app e desativar — incluindo
//  o caso real: o servidor deste PC já pareado por outro cofre (409).
// =============================================================

import { describe, it, expect, afterEach, vi } from "vitest";
import { createSyncController } from "../src/data/syncController";
import { SyncHttpError } from "../src/data/syncClient";
import { authHashFor, deriveAuthToken, formatPairingCode } from "../src/data/syncCrypto";
import { openStore } from "./support/syncKit";

const OTHER_KEY = "22".repeat(32);

function memoryKeyStorage() {
    let saved = null;
    return {
        get saved() {
            return saved;
        },
        load: async () => saved,
        save: async (_vaultKey, keyHex) => {
            saved = keyHex;
        },
        clear: async () => {
            saved = null;
        },
    };
}

/**
 * Servidor de mentira: `pairedHash` é o hash guardado (null = sem pareamento).
 * Registra as chamadas para as asserções.
 */
function fakeServer(pairedHash = null) {
    const state = { pairedHash, calls: [], pushed: [] };
    const factory = ({ token } = {}) => ({
        async status() {
            state.calls.push("status");
            if (!state.pairedHash) throw new SyncHttpError("server_unpaired", "sem pareamento", 412);
            const { sha256 } = await import("./support/hash.js");
            if ((await sha256(token)) !== state.pairedHash) throw new SyncHttpError("unauthorized", "chave errada", 401);
            return { paired: true };
        },
        async pair(authHash, reset = false) {
            state.calls.push(reset ? "pair:reset" : "pair");
            if (state.pairedHash && state.pairedHash !== authHash && !reset) {
                throw new SyncHttpError("conflict", "outra chave", 409);
            }
            state.pairedHash = authHash;
            return { storeId: "s1" };
        },
        async unpair() {
            state.calls.push("unpair");
            state.pairedHash = null;
            return { paired: false };
        },
        async push(_device, changes) {
            state.pushed.push(...changes.map(({ entity, id }) => `${entity}:${id}`));
            return { accepted: changes.map(({ entity, id }) => ({ entity, id })), rejected: [], cursor: 0 };
        },
        async pull(since) {
            return { storeId: "s1", changes: [], cursor: since, hasMore: false };
        },
        async hosts() {
            return { port: 8000, addresses: ["192.168.1.5"] };
        },
    });
    return { state, factory };
}

const controllers = [];
function controllerFor(server, store = openStore(), keyStorage = memoryKeyStorage()) {
    const controller = createSyncController({
        store,
        vaultKey: {},
        clientFactory: server.factory,
        keyStorage,
        pollMs: 1_000_000,
    });
    controllers.push(controller);
    return { controller, store, keyStorage };
}

afterEach(() => {
    while (controllers.length) controllers.pop().stop();
    vi.useRealTimers();
});

describe("syncController", () => {
    it("ativa num servidor livre: pareia, guarda a chave e marca tudo para envio", async () => {
        const server = fakeServer();
        const { controller, store, keyStorage } = controllerFor(server);
        store.write("task", "t1", { title: "A" });
        store.clearDirty("task", "t1", store.dirtyEntries()[0].version);

        await controller.enable();
        await controller.syncNow();

        expect(keyStorage.saved).toMatch(/^[0-9a-f]{64}$/);
        expect(server.state.pairedHash).toBe(await authHashFor(keyStorage.saved));
        // O que já existia antes de ativar vai para o servidor.
        expect(server.state.pushed).toContain("task:t1");
        expect(controller.getStatus().state).not.toBe("inactive");
    });

    it("servidor já pareado com outra chave: recusa (409) sem guardar nada", async () => {
        const server = fakeServer(await authHashFor(OTHER_KEY));
        const { controller, store, keyStorage } = controllerFor(server);
        store.write("note", "n1", { title: "x" });
        store.clearDirty("note", "n1", store.dirtyEntries()[0].version);

        await expect(controller.enable()).rejects.toMatchObject({ kind: "conflict" });
        expect(keyStorage.saved).toBeNull();
        expect(store.dirtyEntries()).toEqual([]);
        expect(server.state.pushed).toEqual([]);
        expect(controller.getStatus().state).toBe("inactive");
    });

    it("redefinir o servidor troca a chave", async () => {
        const server = fakeServer(await authHashFor(OTHER_KEY));
        const { controller, keyStorage } = controllerFor(server);
        await controller.enable({ resetServer: true });
        expect(server.state.calls).toContain("pair:reset");
        expect(server.state.pairedHash).toBe(await authHashFor(keyStorage.saved));
    });

    it("entra com o código do outro app quando o servidor aceita a chave", async () => {
        const server = fakeServer(await authHashFor(OTHER_KEY));
        const { controller, store, keyStorage } = controllerFor(server);
        store.write("routine", "r1", { label: "Água" });
        store.clearDirty("routine", "r1", store.dirtyEntries()[0].version);

        await controller.joinWithCode(formatPairingCode({ keyHex: OTHER_KEY, url: "http://192.168.1.5:8000" }));
        await controller.syncNow();

        expect(keyStorage.saved).toBe(OTHER_KEY);
        expect(server.state.pushed).toContain("routine:r1");
        expect(server.state.calls).not.toContain("pair");
    });

    it("entra com código num servidor sem pareamento: pareia com essa chave", async () => {
        const server = fakeServer(null);
        const { controller, keyStorage } = controllerFor(server);
        await controller.joinWithCode(formatPairingCode({ keyHex: OTHER_KEY, url: "http://10.0.2.2:8000" }));
        expect(server.state.calls).toEqual(["status", "pair"]);
        expect(server.state.pairedHash).toBe(await authHashFor(OTHER_KEY));
        expect(keyStorage.saved).toBe(OTHER_KEY);
    });

    it("código de outra chave (401) e código malformado não guardam nada", async () => {
        const server = fakeServer(await authHashFor("33".repeat(32)));
        const { controller, keyStorage } = controllerFor(server);
        await expect(
            controller.joinWithCode(formatPairingCode({ keyHex: OTHER_KEY, url: "http://x:8000" })),
        ).rejects.toMatchObject({ kind: "unauthorized" });
        await expect(controller.joinWithCode("qualquer coisa")).rejects.toThrow("Código inválido");
        expect(keyStorage.saved).toBeNull();
    });

    it("desativar despareia o servidor e esquece a chave", async () => {
        const server = fakeServer();
        const { controller, keyStorage } = controllerFor(server);
        await controller.enable();
        await controller.disable();
        expect(server.state.calls).toContain("unpair");
        expect(keyStorage.saved).toBeNull();
        expect(controller.getStatus().state).toBe("inactive");
    });

    it("o código de pareamento traz o IP do PC e a chave", async () => {
        const server = fakeServer();
        const { controller, keyStorage } = controllerFor(server);
        await controller.enable();
        const [option] = await controller.pairingOptions();
        expect(option.url).toBe("http://192.168.1.5:8000");
        expect(option.code).toBe(formatPairingCode({ keyHex: keyStorage.saved, url: option.url }));
        expect(await deriveAuthToken(keyStorage.saved)).toMatch(/^[0-9a-f]{64}$/);
    });
});
