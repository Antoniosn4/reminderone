// =============================================================
//  syncController.js
//  Liga, desliga e agenda a sincronização do desktop:
//   - Ativar: gera a chave, registra o hash do token no servidor local
//     e reenvia tudo. Se o servidor já tem outra chave (outro cofre
//     deste PC), quem decide é o usuário: usar o código de lá ou
//     redefinir o servidor.
//   - Rodar: ao abrir, logo depois de cada escrita local e a cada 3 s.
//   - A chave fica no cofre (cifrada pelo PIN), como a do Gemini.
// =============================================================

import { readEncrypted, writeEncrypted, removeEncrypted } from "../services/secureLocalStorage";
import { generateId } from "../utils/id";
import { logger } from "../utils/logger";
import { createSyncClient, SyncHttpError } from "./syncClient";
import {
    authHashFor,
    createSyncCipher,
    deriveAuthToken,
    formatPairingCode,
    generateSyncKeyHex,
    parsePairingCode,
} from "./syncCrypto";
import { createSyncEngine } from "./syncEngine";

const KEY_STORAGE = "reminder-sync-key";
const DEVICE_STORAGE = "reminder-device-id";
const POLL_MS = 3_000;
const DEBOUNCE_MS = 600;

export class PairingCodeError extends Error {
    constructor() {
        super("Código inválido. Copie o código mostrado no app em que a sincronização foi ativada.");
        this.name = "PairingCodeError";
    }
}

export const vaultKeyStorage = {
    async load(vaultKey) {
        const saved = await readEncrypted(vaultKey, KEY_STORAGE, null);
        return saved?.keyHex ?? null;
    },
    save: (vaultKey, keyHex) => writeEncrypted(vaultKey, KEY_STORAGE, { keyHex }),
    clear: async () => removeEncrypted(KEY_STORAGE),
};

function deviceId() {
    try {
        const existing = localStorage.getItem(DEVICE_STORAGE);
        if (existing) return existing;
        const created = `desktop-${generateId()}`;
        localStorage.setItem(DEVICE_STORAGE, created);
        return created;
    } catch {
        return "desktop";
    }
}

/**
 * @param {{
 *   store: ReturnType<import("./dataStore").createDataStore>,
 *   vaultKey: CryptoKey,
 *   clientFactory?: typeof createSyncClient,
 *   keyStorage?: typeof vaultKeyStorage,
 *   pollMs?: number,
 * }} deps
 */
export function createSyncController({
    store,
    vaultKey,
    clientFactory = createSyncClient,
    keyStorage = vaultKeyStorage,
    pollMs = POLL_MS,
}) {
    let engine = null;
    let keyHex = null;
    let status = { state: "inactive" };
    let lastSyncAt = null;
    let timer = null;
    let debounce = null;
    let unsubscribe = null;
    let watcher = null;
    let syncClient = null;
    const listeners = new Set();

    function setStatus(next) {
        status = next;
        for (const listener of [...listeners]) listener();
    }

    async function syncNow() {
        const current = engine;
        if (!current) return;
        setStatus({ state: "syncing", lastSyncAt });
        try {
            await current.sync();
            if (engine !== current) return;
            lastSyncAt = new Date().toISOString();
            setStatus({ state: "idle", lastSyncAt });
            watch();
        } catch (error) {
            if (engine !== current) return;
            const kind = error instanceof SyncHttpError ? error.kind : "server_error";
            if (!(error instanceof SyncHttpError)) logger.error("[sync] falha:", error);
            setStatus({ state: "error", kind, message: error.message, lastSyncAt });
        }
    }

    function watch() {
        if (watcher || !syncClient?.waitForChanges || !engine) return;
        const current = engine;
        const client = syncClient;
        const controller = new AbortController();
        watcher = controller;
        void (async () => {
            try {
                while (engine === current && !controller.signal.aborted) {
                    const cursor = Number(store.getMeta("cursor") ?? 0);
                    const storeId = store.getMeta("storeId") ?? "";
                    const event = await client.waitForChanges(cursor, storeId, controller.signal);
                    if (controller.signal.aborted || engine !== current) break;
                    if (event.cursor !== cursor || event.storeId !== storeId) {
                        await syncNow();
                        if (status.state === "error") break;
                    }
                }
            } catch { /* Periodic polling retries offline and older servers. */ }
            finally { if (watcher === controller) watcher = null; }
        })();
    }

    function startLoop() {
        stopLoop();
        timer = setInterval(() => {
            if (typeof document === "undefined" || document.visibilityState !== "hidden") void syncNow();
        }, pollMs);
        unsubscribe = store.subscribe((event) => {
            if (event?.origin !== "local") return;
            if (debounce) clearTimeout(debounce);
            debounce = setTimeout(() => {
                debounce = null;
                void syncNow();
            }, DEBOUNCE_MS);
        });
    }

    function stopLoop() {
        watcher?.abort();
        watcher = null;
        if (timer) clearInterval(timer);
        if (debounce) clearTimeout(debounce);
        unsubscribe?.();
        timer = null;
        debounce = null;
        unsubscribe = null;
    }

    async function activate(hex, { fresh }) {
        const [token, cipher] = await Promise.all([deriveAuthToken(hex), createSyncCipher(hex)]);
        keyHex = hex;
        syncClient = clientFactory({ token });
        engine = createSyncEngine({ store, client: syncClient, cipher, deviceId: deviceId() });
        if (fresh) {
            // Banco do servidor novo para este app: recebe tudo e envia tudo.
            store.setMeta("cursor", 0);
            store.setMeta("storeId", null);
            store.markAllDirty();
        }
        setStatus({ state: "idle", lastSyncAt });
        startLoop();
        void syncNow();
    }

    return {
        /** Retoma a sincronização se o cofre já tem uma chave. */
        async start() {
            const saved = await keyStorage.load(vaultKey);
            if (saved) await activate(saved, { fresh: false });
        },

        stop() {
            stopLoop();
            engine = null;
        },

        /**
         * Ativa com uma chave nova. Lança `SyncHttpError` "conflict" se o
         * servidor já está pareado com outra chave (e nada muda).
         */
        async enable({ resetServer = false } = {}) {
            const hex = generateSyncKeyHex();
            await clientFactory({}).pair(await authHashFor(hex), resetServer);
            await keyStorage.save(vaultKey, hex);
            await activate(hex, { fresh: true });
        },

        /** Usa a chave de outro app já pareado com este servidor (ou pareia o servidor com ela). */
        async joinWithCode(code) {
            const info = parsePairingCode(code);
            if (!info) throw new PairingCodeError();
            const token = await deriveAuthToken(info.keyHex);
            try {
                await clientFactory({ token }).status();
            } catch (error) {
                if (!(error instanceof SyncHttpError) || error.kind !== "server_unpaired") throw error;
                await clientFactory({}).pair(await authHashFor(info.keyHex), false);
            }
            await keyStorage.save(vaultKey, info.keyHex);
            await activate(info.keyHex, { fresh: true });
        },

        /** Desliga a sincronização: o servidor esquece a chave e os dados cifrados; os dados locais ficam. */
        async disable() {
            stopLoop();
            engine = null;
            try {
                await clientFactory({}).unpair();
            } catch (error) {
                logger.error("[sync] falha ao desparear o servidor:", error);
            }
            await keyStorage.clear();
            keyHex = null;
            store.setMeta("cursor", 0);
            store.setMeta("storeId", null);
            setStatus({ state: "inactive" });
        },

        syncNow,

        /** Endereços do PC na rede e o código de pareamento de cada um (para o QR). */
        async pairingOptions() {
            if (!keyHex) return [];
            const hosts = await clientFactory({}).hosts();
            return (hosts.addresses ?? []).map((address) => {
                const url = `http://${address}:${hosts.port}`;
                return { address, url, code: formatPairingCode({ keyHex, url }) };
            });
        },

        getStatus: () => status,

        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
    };
}
