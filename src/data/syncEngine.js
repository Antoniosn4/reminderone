// =============================================================
//  syncEngine.js
//  Motor da sincronização do desktop (protocolo v1). Mesma lógica do
//  mobile (reminderMobile/src/services/sync/engine.ts):
//   - Envio: os registros pendentes viram envelopes do estado ATUAL,
//     cifrados com a chave de pareamento. A pendência só sai se não
//     houve escrita nova durante o envio. O que o servidor recusa por
//     ser mais antigo volta como a versão dele.
//   - Recebimento: desde o cursor, em páginas; pula o que tem
//     pendência local e o que não é mais novo; storeId diferente =
//     servidor trocou de banco, então tudo é reenviado.
// =============================================================

import { ENTITIES } from "./dataStore";
import { aadFor } from "./syncCrypto";

/**
 * @param {{
 *   store: ReturnType<import("./dataStore").createDataStore>,
 *   client: ReturnType<import("./syncClient").createSyncClient>,
 *   cipher: { encrypt(aad: string, text: string): Promise<string>, decrypt(aad: string, payload: string): Promise<string|null> },
 *   deviceId: string,
 *   batchSize?: number,
 *   pageSize?: number,
 * }} deps
 */
export function createSyncEngine({ store, client, cipher, deviceId, batchSize = 200, pageSize = 500 }) {
    let running = null;
    let runAgain = false;

    async function encode(record) {
        const payload = await cipher.encrypt(aadFor(record), JSON.stringify(record.deleted ? {} : record.data));
        return {
            entity: record.entity,
            id: record.id,
            updatedAt: record.updatedAt,
            deleted: record.deleted,
            payload,
        };
    }

    async function decode(envelope) {
        if (!ENTITIES.includes(envelope.entity)) return null;
        const plaintext = await cipher.decrypt(aadFor(envelope), envelope.payload);
        if (plaintext === null) return null;
        try {
            const data = JSON.parse(plaintext);
            if (!data || typeof data !== "object" || Array.isArray(data)) return null;
            return {
                entity: envelope.entity,
                id: envelope.id,
                updatedAt: envelope.updatedAt,
                deleted: !!envelope.deleted,
                data: envelope.deleted ? {} : data,
            };
        } catch {
            return null;
        }
    }

    async function decodeAll(envelopes) {
        const records = await Promise.all(envelopes.map(decode));
        if (records.some(record => !record)) throw new Error("Não foi possível autenticar os dados recebidos. Tente sincronizar novamente.");
        return records;
    }

    async function pushAll() {
        let pushed = 0;
        for (;;) {
            const batch = store.dirtyEntries().slice(0, batchSize);
            if (batch.length === 0) return pushed;
            const withRecords = batch.map((entry) => ({ entry, record: store.getRecord(entry.entity, entry.id) }));
            // A Entrada existe em todo aparelho com o mesmo id: nunca sincroniza.
            const sendable = withRecords.filter(
                ({ entry, record }) => record && !(entry.entity === "project" && entry.id === "inbox"),
            );
            let rejected = [];
            if (sendable.length > 0) {
                const envelopes = await Promise.all(sendable.map(({ record }) => encode(record)));
                const response = await client.push(deviceId, envelopes);
                for (const { record } of sendable) {
                    if (![...(response.accepted ?? []), ...(response.rejected ?? [])].some(item => item.entity === record.entity && item.id === record.id)) {
                        throw new Error("O servidor não confirmou todas as alterações.");
                    }
                }
                rejected = await decodeAll(response.rejected ?? []);
            }
            store.batch(() => {
                for (const { entry } of withRecords) store.clearDirty(entry.entity, entry.id, entry.version);
                // Versão mais nova no servidor: vale a dele, salvo escrita feita durante o envio.
                for (const record of rejected) {
                    if (!store.isDirty(record.entity, record.id)) store.applyRemote(record);
                }
            });
            pushed += batch.length;
            if (batch.length < batchSize) return pushed;
        }
    }

    async function pullAll() {
        let pulled = 0;
        for (;;) {
            const cursor = Number(store.getMeta("cursor") ?? 0);
            const storeId = store.getMeta("storeId");
            const page = await client.pull(cursor, pageSize);
            if (storeId && page.storeId && page.storeId !== storeId) {
                store.setMeta("cursor", 0);
                store.setMeta("storeId", page.storeId);
                store.markAllDirty();
                return { pulled, restart: true };
            }
            const records = await decodeAll(page.changes);
            store.batch(() => {
                for (const record of records) {
                    if (store.isDirty(record.entity, record.id)) continue;
                    const local = store.getRecord(record.entity, record.id);
                    if (local && local.updatedAt > record.updatedAt) continue;
                    store.applyRemote(record);
                }
            });
            store.setMeta("cursor", page.cursor);
            if (!storeId && page.storeId) store.setMeta("storeId", page.storeId);
            pulled += page.changes.length;
            if (!page.hasMore) return { pulled, restart: false };
        }
    }

    async function runOnce() {
        await store.flushed();
        let pushed = await pushAll();
        let pull = await pullAll();
        if (pull.restart) {
            pushed += await pushAll();
            const again = await pullAll();
            pull = { pulled: pull.pulled + again.pulled, restart: false };
        }
        await store.flushed();
        return { pushed, pulled: pull.pulled };
    }

    return {
        /** Uma rodada por vez; pedidos durante uma rodada geram mais uma no fim. */
        sync() {
            if (running) {
                runAgain = true;
                return running;
            }
            running = (async () => {
                try {
                    let report = await runOnce();
                    while (runAgain) {
                        runAgain = false;
                        const next = await runOnce();
                        report = { pushed: report.pushed + next.pushed, pulled: report.pulled + next.pulled };
                    }
                    return report;
                } finally {
                    running = null;
                    runAgain = false;
                }
            })();
            return running;
        },
    };
}
