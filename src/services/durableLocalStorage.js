// =============================================================
//  durableLocalStorage.js
//  Espelho durável do localStorage no IndexedDB.
//
//  No WebView2 (Tauri) o localStorage é gravado em disco com atraso:
//  fechar o app logo depois de criar o PIN perde o `reminder-vault-meta`
//  (salt + canary), enquanto os registros no IndexedDB (durability
//  "strict") sobrevivem. Na volta o app pedia um PIN novo, derivava outra
//  chave e não conseguia decifrar os dados ("Não foi possível abrir os
//  dados locais").
//
//  Toda escrita no localStorage passa a ser copiada para o IndexedDB e,
//  no boot, as chaves que sumiram do localStorage são restauradas antes
//  do React montar.
// =============================================================

import { openDB } from "idb";
import { logger } from "../utils/logger";

export const MIRROR_DB_NAME = "reminder-local";
const STORE = "kv";

let dbPromise = null;
let chain = Promise.resolve();
let installed = false;

function available() {
    return typeof indexedDB !== "undefined" && typeof localStorage !== "undefined";
}

function db() {
    dbPromise ??= openDB(MIRROR_DB_NAME, 1, {
        upgrade(database) {
            database.createObjectStore(STORE);
        },
    });
    return dbPromise;
}

function enqueue(work) {
    chain = chain.then(work).catch((error) => {
        logger.error("[durableLocalStorage] falha ao espelhar:", error);
    });
    return chain;
}

async function write(mutate) {
    const tx = (await db()).transaction(STORE, "readwrite", { durability: "strict" });
    await mutate(tx.objectStore(STORE));
    await tx.done;
}

/** Restaura do IndexedDB as chaves ausentes do localStorage e espelha as que só existem nele. */
export async function restoreLocalStorage() {
    if (!available()) return;
    try {
        const database = await db();
        const keys = await database.getAllKeys(STORE);
        const values = await database.getAll(STORE);
        const mirrored = new Set(keys);
        keys.forEach((key, index) => {
            if (localStorage.getItem(key) === null) localStorage.setItem(key, values[index]);
        });
        const missing = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!mirrored.has(key)) missing.push([key, localStorage.getItem(key)]);
        }
        if (missing.length) await write((store) => Promise.all(missing.map(([key, value]) => store.put(value, key))));
    } catch (error) {
        logger.error("[durableLocalStorage] falha ao restaurar:", error);
    }
}

/** Passa a copiar cada setItem/removeItem/clear do localStorage para o IndexedDB. */
export function installLocalStorageMirror() {
    if (!available() || installed) return;
    installed = true;
    // Atribuir `localStorage.setItem = ...` criaria um item chamado "setItem":
    // o patch fica no protótipo e só espelha o localStorage (não o sessionStorage).
    const proto = Storage.prototype;
    const { setItem, removeItem, clear } = proto;
    proto.setItem = function (key, value) {
        setItem.call(this, key, value);
        if (this !== localStorage) return;
        const stored = String(value);
        void enqueue(() => write((store) => store.put(stored, String(key))));
    };
    proto.removeItem = function (key) {
        removeItem.call(this, key);
        if (this !== localStorage) return;
        void enqueue(() => write((store) => store.delete(String(key))));
    };
    proto.clear = function () {
        clear.call(this);
        if (this !== localStorage) return;
        void enqueue(() => write((store) => store.clear()));
    };
}

/** Resolve quando todas as escritas espelhadas até agora estão gravadas em disco. */
export function localStorageFlushed() {
    return chain;
}
