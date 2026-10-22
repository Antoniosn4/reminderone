// =============================================================
//  syncKit.js
//  Apoio dos testes da sincronização: servidor em memória com a
//  mesma regra de server/routers/sync.py, e stores prontos.
// =============================================================

import { createDataStore } from "../../src/data/dataStore";
import { createMemoryPersistence } from "../../src/data/persistence";

/** Cifra local de mentira (JSON): os testes de store não dependem do PBKDF2 do cofre. */
export const plainVaultCipher = {
    encrypt: async (data) => JSON.stringify(data),
    decrypt: async (payload) => JSON.parse(payload),
};

export function clockFrom(start) {
    let ticks = 0;
    return () => Date.parse(start) + 1000 * ticks++;
}

export function openStore({ start = "2026-10-11T12:00:00.000Z", persistence = createMemoryPersistence() } = {}) {
    return createDataStore({ persistence, vaultCipher: plainVaultCipher, clock: clockFrom(start) });
}

export function createFakeSyncServer() {
    const records = new Map();
    let lastSeq = 0;
    let storeId = "store-1";
    let resets = 1;
    const keyOf = (entity, id) => `${entity}:${id}`;

    const server = {
        records,
        get storeId() {
            return storeId;
        },
        reset() {
            records.clear();
            resets += 1;
            storeId = `store-${resets}`;
        },
        put(envelope) {
            lastSeq += 1;
            records.set(keyOf(envelope.entity, envelope.id), { ...envelope, seq: lastSeq });
        },
        get(entity, id) {
            return records.get(keyOf(entity, id)) ?? null;
        },
        client() {
            return {
                async push(_deviceId, changes) {
                    const accepted = [];
                    const rejected = [];
                    for (const change of changes) {
                        const current = records.get(keyOf(change.entity, change.id));
                        if (current && current.updatedAt > change.updatedAt) {
                            rejected.push(current);
                            continue;
                        }
                        if (!current || current.updatedAt !== change.updatedAt || current.payload !== change.payload || current.deleted !== change.deleted) {
                            server.put(change);
                        }
                        accepted.push({ entity: change.entity, id: change.id });
                    }
                    return { accepted, rejected, cursor: lastSeq };
                },
                async pull(since, limit) {
                    const all = [...records.values()].filter((r) => r.seq > since).sort((a, b) => a.seq - b.seq);
                    const page = all.slice(0, limit);
                    const hasMore = all.length > limit;
                    const cursor = page.length ? page[page.length - 1].seq : since;
                    return { storeId, changes: page, cursor: hasMore ? cursor : Math.max(cursor, lastSeq), hasMore };
                },
            };
        },
    };
    return server;
}
