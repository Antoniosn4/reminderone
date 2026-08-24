// =============================================================
//  secureLocalStorage.js
//  Wrapper criptografado sobre localStorage para coleções pequenas
//  (projetos, equipes, rotinas). O conteúdo persistido é sempre
//  um payload AES-GCM serializado em JSON.
// =============================================================

import { encryptObject, decryptObject } from "./cryptoService";
import { logger } from "../utils/logger";

export async function readEncrypted(key, storageKey, fallback) {
    if (!key) return fallback;
    const raw = localStorage.getItem(storageKey);
    if (!raw) return fallback;
    try {
        const payload = JSON.parse(raw);
        return await decryptObject(key, payload);
    } catch (error) {
        logger.error(`[secureLocalStorage] Falha ao ler ${storageKey}:`, error);
        return fallback;
    }
}

export async function writeEncrypted(key, storageKey, value) {
    if (!key) return;
    try {
        const payload = await encryptObject(key, value);
        localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch (error) {
        logger.error(`[secureLocalStorage] Falha ao gravar ${storageKey}:`, error);
    }
}

export function removeEncrypted(storageKey) {
    localStorage.removeItem(storageKey);
}
