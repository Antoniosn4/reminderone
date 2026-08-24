// =============================================================
//  cryptoService.js
//  Primitivas criptográficas via WebCrypto API nativa.
//  Zero dependências externas.
//
//  Algoritmos:
//    - Derivação de chave: PBKDF2-SHA256 com 600.000 iterações
//      (recomendação OWASP 2023).
//    - Cifragem: AES-GCM-256 (autenticação + confidencialidade).
//    - Salt: 16 bytes aleatórios (CSPRNG via crypto.getRandomValues).
//    - IV: 12 bytes aleatórios por operação (NIST SP 800-38D).
//
//  DECISÃO DE DESIGN (salt em localStorage):
//    O salt de derivação de chave é persistido em plaintext no
//    localStorage. Isso é necessário por design: sem o salt, não
//    é possível re-derivar a chave ao reabrir o app. O salt sozinho
//    não compromete a segurança — o atacante ainda precisa da senha.
//    Ref: OWASP Password Storage Cheat Sheet, seção "Salt Generation".
// =============================================================

const SALT_BYTES = 16;
const IV_BYTES = 12;
const PBKDF2_ITERATIONS = 600_000;
const AES_KEY_BITS = 256;
const PAYLOAD_VERSION = 1;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
}

function base64ToBuffer(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
}

export function generateSalt() {
    return crypto.getRandomValues(new Uint8Array(SALT_BYTES));
}

function generateIv() {
    return crypto.getRandomValues(new Uint8Array(IV_BYTES));
}

/**
 * Deriva uma chave AES-GCM-256 a partir da master password.
 * @param {string} password - Senha em claro (deve ser descartada após uso).
 * @param {Uint8Array} salt - Salt persistido.
 * @returns {Promise<CryptoKey>}
 */
export async function deriveKeyFromPassword(password, salt) {
    const baseKey = await crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        "PBKDF2",
        false,
        ["deriveKey"],
    );

    return crypto.subtle.deriveKey(
        { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
        baseKey,
        { name: "AES-GCM", length: AES_KEY_BITS },
        false,
        ["encrypt", "decrypt"],
    );
}

/**
 * Cifra um objeto JSON-serializável.
 * Retorna um payload portátil (base64) com IV embutido.
 */
export async function encryptObject(key, obj) {
    const iv = generateIv();
    const plaintext = encoder.encode(JSON.stringify(obj));
    const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        plaintext,
    );
    return {
        v: PAYLOAD_VERSION,
        iv: bufferToBase64(iv),
        data: bufferToBase64(ciphertext),
    };
}

/**
 * Decifra um payload retornando o objeto original.
 * Lança se a chave estiver errada ou os bytes tiverem sido adulterados
 * (AES-GCM detecta integridade via tag de autenticação).
 */
export async function decryptObject(key, payload) {
    if (!payload || payload.v !== PAYLOAD_VERSION) {
        throw new Error("Payload inválido ou versão não suportada");
    }
    const iv = new Uint8Array(base64ToBuffer(payload.iv));
    const ciphertext = base64ToBuffer(payload.data);
    const plaintext = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        ciphertext,
    );
    return JSON.parse(decoder.decode(plaintext));
}
