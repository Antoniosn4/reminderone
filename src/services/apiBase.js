// =============================================================
//  apiBase.js
//  Resolve a URL do backend local conforme o runtime:
//    - Browser/dev Vite: usa /api e deixa o proxy do Vite encaminhar.
//    - Desktop Tauri: fala direto com o sidecar em 127.0.0.1:8000.
// =============================================================

const DEFAULT_SIDECAR_ORIGIN = "http://127.0.0.1:8000";

function normalizePath(path) {
    return path.startsWith("/") ? path : `/${path}`;
}

export function isTauriRuntime() {
    if (typeof window === "undefined") return false;
    if ("__TAURI_INTERNALS__" in window || "__TAURI__" in window) return true;

    const origin = window.location?.origin ?? "";
    return origin === "tauri://localhost" || origin.includes("tauri.localhost");
}

export function apiUrl(path) {
    const normalized = normalizePath(path);
    if (!isTauriRuntime()) return normalized;

    const origin = import.meta.env.VITE_REMINDER_API_ORIGIN || DEFAULT_SIDECAR_ORIGIN;
    return `${origin}${normalized}`;
}
