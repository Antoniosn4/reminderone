// SHA-256 em hex, como o servidor guarda o token (server/security.py).
export async function sha256(text) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(text ?? "")));
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
