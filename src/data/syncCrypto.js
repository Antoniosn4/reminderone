// =============================================================
//  syncCrypto.js
//  Formatos e cifra do protocolo de sincronização
//  (docs/SYNC_PROTOCOL.md). Idêntico ao do mobile
//  (reminderMobile/src/services/sync/codec.ts e cipher.ts): os dois
//  testes usam o mesmo vetor conhecido.
// =============================================================

const PAIRING_PREFIX = "reminder-sync:v1:";
const AUTH_TOKEN_PREFIX = "reminder-sync-auth|";
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64(bytes) {
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
}

function base64ToBytes(value) {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
}

function bytesToHex(bytes) {
    return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let index = 0; index < bytes.length; index += 1) {
        bytes[index] = parseInt(hex.slice(index * 2, index * 2 + 2), 16);
    }
    return bytes;
}

async function sha256Hex(text) {
    return bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(text))));
}

/** Dado autenticado da cifra: amarra o conteúdo ao registro, à versão e ao "excluído". */
export function aadFor({ entity, id, updatedAt, deleted }) {
    return `${entity}|${id}|${updatedAt}|${deleted ? 1 : 0}`;
}

/** Chave nova de sincronização: 32 bytes aleatórios em hex. */
export function generateSyncKeyHex() {
    return bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
}

/** Token de acesso: SHA-256 de "reminder-sync-auth|<chave>". */
export function deriveAuthToken(keyHex) {
    return sha256Hex(`${AUTH_TOKEN_PREFIX}${keyHex}`);
}

/** O que o servidor guarda: o SHA-256 do token. */
export async function authHashFor(keyHex) {
    return sha256Hex(await deriveAuthToken(keyHex));
}

export function formatPairingCode({ keyHex, url }) {
    return `${PAIRING_PREFIX}${keyHex}:${url}`;
}

/** Lê o código de pareamento; null se não for do Reminder. */
export function parsePairingCode(text) {
    const trimmed = String(text ?? "").trim();
    if (!trimmed.startsWith(PAIRING_PREFIX)) return null;
    const rest = trimmed.slice(PAIRING_PREFIX.length);
    const separator = rest.indexOf(":");
    if (separator === -1) return null;
    const keyHex = rest.slice(0, separator).toLowerCase();
    const url = rest.slice(separator + 1).trim().replace(/\/+$/, "");
    if (!/^[0-9a-f]{64}$/.test(keyHex)) return null;
    if (!/^https?:\/\/[^\s/]+/.test(url)) return null;
    return { keyHex, url };
}

/**
 * AES-256-GCM com a chave de sincronização. `nextIv` só existe para o vetor
 * de teste; em uso, o IV é aleatório.
 */
export async function createSyncCipher(keyHex, nextIv = () => crypto.getRandomValues(new Uint8Array(12))) {
    const key = await crypto.subtle.importKey("raw", hexToBytes(keyHex), "AES-GCM", false, ["encrypt", "decrypt"]);
    return {
        async encrypt(aad, plaintext) {
            const iv = nextIv();
            const ciphertext = await crypto.subtle.encrypt(
                { name: "AES-GCM", iv, additionalData: encoder.encode(aad) },
                key,
                encoder.encode(plaintext),
            );
            return `v1.${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(ciphertext))}`;
        },
        async decrypt(aad, payload) {
            const parts = String(payload).split(".");
            if (parts.length !== 3 || parts[0] !== "v1") return null;
            try {
                const plaintext = await crypto.subtle.decrypt(
                    { name: "AES-GCM", iv: base64ToBytes(parts[1]), additionalData: encoder.encode(aad) },
                    key,
                    base64ToBytes(parts[2]),
                );
                return decoder.decode(plaintext);
            } catch {
                return null;
            }
        },
    };
}
