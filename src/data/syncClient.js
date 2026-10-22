// =============================================================
//  syncClient.js
//  Cliente HTTP das rotas /api/sync do servidor local
//  (server/routers/sync.py). Erros já classificados para a tela.
// =============================================================

import { apiUrl } from "../services/apiBase";

export class SyncHttpError extends Error {
    /** @param {"offline"|"unauthorized"|"server_unpaired"|"conflict"|"server_error"} kind */
    constructor(kind, message, status = 0) {
        super(message);
        this.name = "SyncHttpError";
        this.kind = kind;
        this.status = status;
    }
}

const TIMEOUT_MS = 15_000;

async function request(path, { token, method = "GET", body, signal, timeout = TIMEOUT_MS, fetchImpl = fetch } = {}) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    const timer = setTimeout(abort, timeout);
    let response;
    try {
        response = await fetchImpl(apiUrl(`/api/sync${path}`), {
            method,
            signal: controller.signal,
            headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
    } catch {
        throw new SyncHttpError("offline", "Servidor local fora do ar. Abra o app pelo atalho do Reminder.");
    } finally {
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
    }
    if (response.status === 401) throw new SyncHttpError("unauthorized", "A chave deste app não é a do servidor.", 401);
    if (response.status === 412) throw new SyncHttpError("server_unpaired", "A sincronização está desligada no servidor.", 412);
    if (response.status === 409) throw new SyncHttpError("conflict", "O servidor já está pareado com outra chave.", 409);
    if (!response.ok) throw new SyncHttpError("server_error", `O servidor respondeu com erro (${response.status}).`, response.status);
    return response.json();
}

/** @param {{ token?: string, fetchImpl?: typeof fetch }} options */
export function createSyncClient({ token, fetchImpl } = {}) {
    return {
        waitForChanges: (since, storeId, signal) => request(`/changes?since=${since}&store_id=${encodeURIComponent(storeId)}`, { token, fetchImpl, signal, timeout: 30_000 }),
        status: () => request("/status", { token, fetchImpl }),
        push: (deviceId, changes) => request("/push", { token, fetchImpl, method: "POST", body: { deviceId, changes } }),
        pull: (since, limit) => request(`/pull?since=${since}&limit=${limit}`, { token, fetchImpl }),
        pair: (authHash, reset = false) => request("/pair", { fetchImpl, method: "POST", body: { authHash, reset } }),
        unpair: () => request("/unpair", { fetchImpl, method: "POST" }),
        hosts: () => request("/hosts", { fetchImpl }),
    };
}
