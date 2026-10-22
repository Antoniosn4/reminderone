// =============================================================
//  dataStore.js
//  Fonte da verdade dos dados do desktop: registros do protocolo de
//  sincronização (docs/SYNC_PROTOCOL.md) — tarefas, projetos, Kanban,
//  anotações, rotinas e perfil —, guardados cifrados com a chave do
//  cofre (PIN) e espelhados em memória para a UI.
//
//  Cada registro: { entity, id, updatedAt, deleted, data }. Escrever
//  marca o registro como pendente de envio (outbox com versão: uma
//  escrita durante o envio não se perde). Registros vindos do celular
//  entram por `applyRemote`, sem gerar pendência.
// =============================================================

import { logger } from "../utils/logger";

export const ENTITIES = Object.freeze([
    "project",
    "task",
    "kanban_board",
    "kanban_column",
    "kanban_card",
    "note",
    "routine",
    "profile",
]);

const keyOf = (entity, id) => `${entity}:${id}`;

/** Um instante ISO maior que `previous`: duas edições seguidas nunca empatam. */
function nextTimestamp(previous, clock) {
    let now = clock();
    if (previous && Date.parse(previous) >= now) now = Date.parse(previous) + 1;
    return new Date(now).toISOString();
}

/**
 * @param {{
 *   persistence: {
 *     loadAll(): Promise<{ records: object[], outbox: object[], meta: Record<string, unknown> }>,
 *     commit(snapshot: { records: object[], outbox: object[], meta: object }): Promise<void>,
 *   },
 *   vaultCipher: { encrypt(obj: object): Promise<unknown>, decrypt(payload: unknown): Promise<object> },
 *   clock?: () => number,
 * }} deps
 */
export function createDataStore({ persistence, vaultCipher, clock = () => Date.now() }) {
    const records = new Map();
    const outbox = new Map();
    const meta = new Map();
    const listeners = new Set();
    const persistenceListeners = new Set();
    const snapshots = new Map();
    let version = 0;
    let batchDepth = 0;
    let pendingEntities = new Set();
    // Houve escrita local no aviso pendente? (Só remoto não dispara envio.)
    let pendingHasLocal = false;
    let chain = Promise.resolve();

    let persistenceState = { state: "saved", error: null };
    let scheduled = false;
    function reportPersistence(state, error = null) {
        persistenceState = { state, error };
        for (const listener of [...persistenceListeners]) {
            try { listener({ entities: new Set(), origin: "persistence" }); }
            catch (failure) { logger.error("[dataStore] listener falhou:", failure); }
        }
    }
    function persist() {
        if (scheduled) return;
        scheduled = true;
        reportPersistence("saving");
        // Coalesce synchronous mutations, including cascades and remote pages.
        chain = chain.catch(() => undefined).then(async () => {
            scheduled = false;
            const snapshot = structuredClone({
                records: [...records.values()],
                outbox: [...outbox.entries()].map(([key, entryVersion]) => {
                    const separator = key.indexOf(":");
                    return { key, entity: key.slice(0, separator), id: key.slice(separator + 1), version: entryVersion };
                }),
                meta: Object.fromEntries(meta),
            });
            const encrypted = await Promise.all(snapshot.records.map(async record => ({
                key: keyOf(record.entity, record.id),
                format: 2,
                payload: await vaultCipher.encrypt(record),
            })));
            await persistence.commit({ ...snapshot, records: encrypted });
            if (!scheduled) reportPersistence("saved");
        });
        // Keep rejection observable through flushed(), while avoiding an unhandled promise.
        void chain.catch(error => { reportPersistence("error", error); });
    }

    function emit(entity, origin) {
        snapshots.delete(entity);
        pendingEntities.add(entity);
        if (origin === "local") pendingHasLocal = true;
        if (batchDepth === 0) flushNotify();
    }

    function flushNotify() {
        if (pendingEntities.size === 0) return;
        const event = { entities: pendingEntities, origin: pendingHasLocal ? "local" : "remote" };
        pendingEntities = new Set();
        pendingHasLocal = false;
        for (const listener of [...listeners]) {
            try {
                listener(event);
            } catch (error) {
                logger.error("[dataStore] listener falhou:", error);
            }
        }
    }

    function saveRecord(record) {
        records.set(keyOf(record.entity, record.id), structuredClone(record));
        persist();
    }

    function markDirty(entity, id) {
        const key = keyOf(entity, id);
        version += 1;
        outbox.set(key, version);
        persist();
    }

    const store = {
        async load() {
            const loaded = await persistence.loadAll();
            for (const row of loaded.records) {
                // Fail closed: never silently discard an unreadable local record.
                if (row.format === 2) {
                    const record = await vaultCipher.decrypt(row.payload);
                    if (keyOf(record.entity, record.id) !== row.key) throw new Error("Identidade do registro adulterada.");
                    records.set(row.key, record);
                } else {
                    const data = row.deleted ? {} : await vaultCipher.decrypt(row.payload);
                    records.set(row.key, { entity: row.entity, id: row.id, updatedAt: row.updatedAt, deleted: !!row.deleted, data });
                }
            }
            for (const entry of loaded.outbox) {
                outbox.set(entry.key, entry.version);
                version = Math.max(version, entry.version);
            }
            for (const [name, value] of Object.entries(loaded.meta)) meta.set(name, value);
        },

        /** Registros vivos da entidade: `{ id, updatedAt, ...data }`. Mesma referência até mudar. */
        list(entity) {
            if (!snapshots.has(entity)) {
                const live = [];
                for (const record of records.values()) {
                    if (record.entity === entity && !record.deleted) {
                        live.push({ ...record.data, id: record.id, updatedAt: record.updatedAt });
                    }
                }
                snapshots.set(entity, live);
            }
            return snapshots.get(entity);
        },

        get(entity, id) {
            const record = records.get(keyOf(entity, id));
            return record && !record.deleted ? { ...record.data, id, updatedAt: record.updatedAt } : null;
        },

        /** O registro completo, inclusive lápide. */
        getRecord(entity, id) {
            return records.get(keyOf(entity, id)) ?? null;
        },

        /**
         * Grava `data` por cima do que o registro já tem (os campos que o
         * desktop não conhece, vindos do celular, ficam) e marca pendente.
         */
        write(entity, id, data, { replace = false } = {}) {
            const current = records.get(keyOf(entity, id));
            const base = !replace && current && !current.deleted ? current.data : {};
            const record = {
                entity,
                id,
                updatedAt: nextTimestamp(current?.updatedAt, clock),
                deleted: false,
                data: { ...base, ...data },
            };
            saveRecord(record);
            markDirty(entity, id);
            emit(entity, "local");
            return { ...record.data, id, updatedAt: record.updatedAt };
        },

        /** Exclusão lógica: a lápide também sincroniza. */
        remove(entity, id) {
            const current = records.get(keyOf(entity, id));
            if (!current || current.deleted) return;
            saveRecord({ entity, id, updatedAt: nextTimestamp(current.updatedAt, clock), deleted: true, data: {} });
            markDirty(entity, id);
            emit(entity, "local");
        },

        /** Agrupa várias escritas num aviso só (ex.: excluir uma pasta e tudo dentro dela). */
        batch(work) {
            batchDepth += 1;
            try {
                return work();
            } finally {
                batchDepth -= 1;
                if (batchDepth === 0) flushNotify();
            }
        },

        /** Registro decifrado vindo do servidor. Não gera pendência. */
        applyRemote({ entity, id, updatedAt, deleted, data }) {
            saveRecord({ entity, id, updatedAt, deleted, data: deleted ? {} : data });
            emit(entity, "remote");
        },

        isDirty(entity, id) {
            return outbox.has(keyOf(entity, id));
        },

        dirtyEntries() {
            return [...outbox.entries()].map(([key, entryVersion]) => {
                const separator = key.indexOf(":");
                return { key, entity: key.slice(0, separator), id: key.slice(separator + 1), version: entryVersion };
            });
        },

        /** Tira da fila só se não houve escrita nova desde `entryVersion`. */
        clearDirty(entity, id, entryVersion) {
            const key = keyOf(entity, id);
            if (outbox.get(key) !== entryVersion) return false;
            outbox.delete(key);
            persist();
            return true;
        },

        /** Tudo pendente de novo (pareamento, servidor que trocou de banco). */
        markAllDirty() {
            for (const record of records.values()) markDirty(record.entity, record.id);
        },

        getMeta(name) {
            return meta.get(name) ?? null;
        },

        setMeta(name, value) {
            if (meta.get(name) === value) return;
            meta.set(name, value);
            persist();
        },

        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },

        /** Espera as gravações em andamento (testes, troca de cofre). */
        async flushed() {
            let pending;
            do { pending = chain; await pending; } while (pending !== chain);
        },
        getPersistenceStatus: () => persistenceState,
        subscribePersistence(listener) { persistenceListeners.add(listener); return () => persistenceListeners.delete(listener); },
        retryPersistence() { persist(); return store.flushed(); },
    };
    return store;
}
