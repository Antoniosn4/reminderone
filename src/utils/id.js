// =============================================================
//  id.js
//  Geração de identificadores únicos para entidades locais.
//  Prioriza crypto.randomUUID() (RFC 4122 v4) — disponível em
//  contextos seguros (HTTPS / localhost). Fallback determinístico
//  apenas para ambientes legados.
// =============================================================

const FALLBACK_RADIX = 36;
const FALLBACK_SLICE = 10;

export function generateId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }
    const random = Math.random().toString(FALLBACK_RADIX).slice(2, FALLBACK_SLICE);
    return `${Date.now()}-${random}`;
}
