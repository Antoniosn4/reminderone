// =============================================================
//  secureStorage.js
//  Camada de persistência criptografada para tarefas (IndexedDB).
//  Cada tarefa é cifrada individualmente com AES-GCM antes de ser
//  gravada — IV único por registro garante que payloads idênticos
//  produzam ciphertexts diferentes.
//
//  Banco  : reminder-db v2
//  Stores : tasks_encrypted (novo, criptografado)
//           tasks           (legado, mantido para migração)
// =============================================================

import { openDB } from "idb";
import { encryptObject, decryptObject } from "./cryptoService";
import { logger } from "../utils/logger";

const DB_NAME = "reminder-db";
const DB_VERSION = 2;
const STORE_NAME = "tasks_encrypted";
const LEGACY_STORE = "tasks";

let dbInstance = null;

async function getDB() {
    if (dbInstance) return dbInstance;

    dbInstance = await openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: "id" });
            }
            if (!db.objectStoreNames.contains(LEGACY_STORE)) {
                db.createObjectStore(LEGACY_STORE, { keyPath: "id" });
            }
        },
    });

    return dbInstance;
}

function ensureKey(key) {
    if (!key) throw new Error("[secureStorage] vault key ausente");
}

/**
 * Lê e decifra todas as tarefas. Registros corrompidos são pulados
 * com log local — nunca lança exceção que pare a UI.
 */
export async function getAllTasks(key) {
    ensureKey(key);
    try {
        const db = await getDB();
        const records = await db.getAll(STORE_NAME);
        const decrypted = [];
        for (const record of records) {
            try {
                const task = await decryptObject(key, record.payload);
                decrypted.push(task);
            } catch {
                logger.error("[secureStorage] Tarefa corrompida ignorada:", record.id);
            }
        }
        return decrypted;
    } catch (error) {
        logger.error("[secureStorage] Falha ao ler tarefas:", error);
        return [];
    }
}

export async function putTask(key, task) {
    ensureKey(key);
    if (!task || task.id === undefined || task.id === null) return;
    try {
        const db = await getDB();
        const payload = await encryptObject(key, task);
        await db.put(STORE_NAME, { id: task.id, payload });
    } catch (error) {
        logger.error("[secureStorage] Falha ao salvar tarefa:", error);
    }
}

export async function deleteTaskById(id) {
    if (id === undefined || id === null) return;
    try {
        const db = await getDB();
        await db.delete(STORE_NAME, id);
    } catch (error) {
        logger.error("[secureStorage] Falha ao remover tarefa:", error);
    }
}

// ----- Suporte à migração one-time do store em plaintext -----

export async function getLegacyTasks() {
    try {
        const db = await getDB();
        if (!db.objectStoreNames.contains(LEGACY_STORE)) return [];
        return await db.getAll(LEGACY_STORE);
    } catch {
        return [];
    }
}

export async function clearLegacyTasks() {
    try {
        const db = await getDB();
        if (db.objectStoreNames.contains(LEGACY_STORE)) {
            await db.clear(LEGACY_STORE);
        }
    } catch (error) {
        logger.error("[secureStorage] Falha ao limpar legacy:", error);
    }
}
