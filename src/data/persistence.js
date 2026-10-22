// =============================================================
//  persistence.js
//  IndexedDB do armazenamento de registros (reminder-data v1).
//  Os registros já chegam cifrados pela chave do cofre.
// =============================================================

import { openDB } from "idb";
import { encryptObject, decryptObject } from "../services/cryptoService";

export const DATA_DB_NAME = "reminder-data";
const DATA_DB_VERSION = 1;

export async function createIdbPersistence() {
    const db = await openDB(DATA_DB_NAME, DATA_DB_VERSION, {
        upgrade(database) {
            database.createObjectStore("records", { keyPath: "key" });
            database.createObjectStore("outbox", { keyPath: "key" });
            database.createObjectStore("meta", { keyPath: "name" });
        },
    });
    let revision = 0;
    return {
        async commit({ records, outbox, meta }) {
            const tx = db.transaction(["records", "outbox", "meta"], "readwrite", { durability: "strict" });
            const actual = (await tx.objectStore("meta").get("__revision"))?.value ?? 0;
            if (actual !== revision) {
                tx.abort();
                await tx.done.catch(() => undefined);
                throw new Error("Outro app alterou este cofre. Preserve suas alterações antes de reabrir; use apenas uma aba por cofre.");
            }
            for (const name of ["records", "outbox", "meta"]) await tx.objectStore(name).clear();
            for (const row of records) await tx.objectStore("records").put(row);
            for (const row of outbox) await tx.objectStore("outbox").put(row);
            for (const [name, value] of Object.entries(meta)) await tx.objectStore("meta").put({ name, value });
            await tx.objectStore("meta").put({ name: "__revision", value: revision + 1 });
            await tx.done;
            revision += 1;
        },
        async loadAll() {
            const tx = db.transaction(["records", "outbox", "meta"], "readonly");
            const [records, outbox, metaRows] = await Promise.all([
                tx.objectStore("records").getAll(),
                tx.objectStore("outbox").getAll(),
                tx.objectStore("meta").getAll(),
            ]);
            await tx.done;
            revision = metaRows.find(row => row.name === "__revision")?.value ?? 0;
            return { records, outbox, meta: Object.fromEntries(metaRows.filter(row => row.name !== "__revision").map((row) => [row.name, row.value])) };
        },
        putRecord: (row) => db.put("records", row),
        putOutbox: (entry) => db.put("outbox", entry),
        deleteOutbox: (key) => db.delete("outbox", key),
        putMeta: (name, value) => db.put("meta", { name, value }),
    };
}

/** Persistência em memória, para os testes. */
export function createMemoryPersistence(initial = { records: [], outbox: [], meta: {} }) {
    const records = new Map(initial.records.map((row) => [row.key, row]));
    const outbox = new Map(initial.outbox.map((entry) => [entry.key, entry]));
    const meta = new Map(Object.entries(initial.meta));
    return {
        records,
        outbox,
        meta,
        async commit(snapshot) {
            records.clear(); outbox.clear(); meta.clear();
            for (const row of snapshot.records) records.set(row.key, structuredClone(row));
            for (const row of snapshot.outbox) outbox.set(row.key, structuredClone(row));
            for (const [key, value] of Object.entries(snapshot.meta)) meta.set(key, value);
        },
        async loadAll() {
            return { records: [...records.values()], outbox: [...outbox.values()], meta: Object.fromEntries(meta) };
        },
        async putRecord(row) {
            records.set(row.key, row);
        },
        async putOutbox(entry) {
            outbox.set(entry.key, entry);
        },
        async deleteOutbox(key) {
            outbox.delete(key);
        },
        async putMeta(name, value) {
            meta.set(name, value);
        },
    };
}

/** A cifra do armazenamento local: a mesma das tarefas de hoje (AES-GCM com a chave do PIN). */
export function createVaultCipher(vaultKey) {
    return {
        encrypt: (data) => encryptObject(vaultKey, data),
        decrypt: (payload) => decryptObject(vaultKey, payload),
    };
}
