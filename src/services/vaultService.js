// =============================================================
//  vaultService.js
//  Ciclo de vida do vault local: setup, unlock, validação por
//  canary token e backoff exponencial contra força bruta.
//
//  Persistência (em localStorage, não secreto):
//    - reminder-vault-meta = { salt, canary, createdAt }
//    - reminder-vault-attempts = { count, lastFailedAt }
//
//  O salt PRECISA ser persistido em claro — sem ele é impossível
//  derivar a chave novamente. O canary token é um valor conhecido
//  cifrado que valida que a senha está correta sem precisar
//  decifrar dados reais.
// =============================================================

import {
    deriveKeyFromPassword,
    encryptObject,
    decryptObject,
    generateSalt,
} from "./cryptoService";

const VAULT_META_KEY = "reminder-vault-meta";
const ATTEMPTS_KEY = "reminder-vault-attempts";
const CANARY_PLAINTEXT = "reminder-vault-canary-v1";

// Backoff escalonado: tentativas falhas → atraso obrigatório.
const BACKOFF_STEPS_MS = [0, 1_000, 2_000, 5_000, 10_000, 30_000];

function bytesToBase64(bytes) {
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
}

function base64ToBytes(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

function readJson(storageKey, fallback) {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return fallback;
    try {
        return JSON.parse(raw);
    } catch {
        return fallback;
    }
}

function loadMeta() {
    return readJson(VAULT_META_KEY, null);
}

function saveMeta(meta) {
    localStorage.setItem(VAULT_META_KEY, JSON.stringify(meta));
}

function loadAttempts() {
    return readJson(ATTEMPTS_KEY, { count: 0, lastFailedAt: 0 });
}

function saveAttempts(attempts) {
    localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(attempts));
}

function clearAttempts() {
    localStorage.removeItem(ATTEMPTS_KEY);
}

export function isVaultInitialized() {
    return loadMeta() !== null;
}

/**
 * Tempo obrigatório de espera antes da próxima tentativa de unlock,
 * baseado em quantas tentativas falhas ocorreram recentemente.
 */
export function getLockoutDelayMs() {
    const { count, lastFailedAt } = loadAttempts();
    if (count === 0) return 0;
    const stepIdx = Math.min(count, BACKOFF_STEPS_MS.length - 1);
    const requiredDelay = BACKOFF_STEPS_MS[stepIdx];
    const elapsed = Date.now() - lastFailedAt;
    return Math.max(0, requiredDelay - elapsed);
}

/**
 * Configura o vault pela primeira vez.
 * Gera salt fresco, deriva a chave, cifra o canary e persiste a meta.
 * @returns {Promise<CryptoKey>}
 */
export async function setupVault(password) {
    const salt = generateSalt();
    const key = await deriveKeyFromPassword(password, salt);
    const canary = await encryptObject(key, CANARY_PLAINTEXT);
    saveMeta({
        salt: bytesToBase64(salt),
        canary,
        createdAt: Date.now(),
    });
    clearAttempts();
    return key;
}

/**
 * Tenta destravar o vault com a senha fornecida.
 * Retorna a CryptoKey em sucesso, null em senha errada.
 * Lança LOCKED_OUT se ainda em backoff.
 */
export async function unlockVault(password) {
    const meta = loadMeta();
    if (!meta) throw new Error("Vault não inicializado");

    const delay = getLockoutDelayMs();
    if (delay > 0) {
        const err = new Error("Aguarde antes de tentar novamente");
        err.code = "LOCKED_OUT";
        err.retryInMs = delay;
        throw err;
    }

    const salt = base64ToBytes(meta.salt);
    const key = await deriveKeyFromPassword(password, salt);

    try {
        const decrypted = await decryptObject(key, meta.canary);
        if (decrypted !== CANARY_PLAINTEXT) throw new Error("canary mismatch");
        clearAttempts();
        return key;
    } catch {
        const attempts = loadAttempts();
        saveAttempts({
            count: attempts.count + 1,
            lastFailedAt: Date.now(),
        });
        return null;
    }
}

/**
 * Apaga toda a configuração do vault. Operação irreversível.
 */
export function destroyVault() {
    localStorage.removeItem(VAULT_META_KEY);
    clearAttempts();
}
