// =============================================================
//  syncClient.test.js
//  Contrato do cliente HTTP de /api/sync: quais rotas levam o
//  token, como erros viram categorias para a tela e quando a
//  requisição é abortada (sinal externo ou timeout).
// =============================================================

import { afterEach, describe, expect, it, vi } from "vitest";
import { createSyncClient, SyncHttpError } from "../src/data/syncClient";

const TOKEN = "token-de-transporte";

function jsonResponse(body, status = 200) {
    return { ok: status >= 200 && status < 300, status, json: async () => body };
}

/** fetch falso que registra cada chamada e responde 200 com `{ ok: true }`. */
function recordingFetch(response = jsonResponse({ ok: true })) {
    return vi.fn(async () => response);
}

/**
 * fetch falso que só termina quando o sinal da requisição é abortado.
 * Como o fetch real, rejeita de imediato se o sinal já chega abortado.
 */
function hangingFetch() {
    return vi.fn((_url, { signal }) => new Promise((_resolve, reject) => {
        const abort = () => reject(new DOMException("Aborted", "AbortError"));
        if (signal.aborted) abort();
        signal.addEventListener("abort", abort);
    }));
}

function headersOf(fetchImpl) {
    return fetchImpl.mock.calls[0][1].headers;
}

afterEach(() => {
    vi.useRealTimers();
});

describe("syncClient — autenticação por rota", () => {
    it.each([
        ["status", (c) => c.status()],
        ["push", (c) => c.push("device-1", [])],
        ["pull", (c) => c.pull(0, 100)],
        ["waitForChanges", (c) => c.waitForChanges(0, "store-1")],
    ])("envia o token Bearer em %s", async (_name, call) => {
        const fetchImpl = recordingFetch();
        await call(createSyncClient({ token: TOKEN, fetchImpl }));
        expect(headersOf(fetchImpl).Authorization).toBe(`Bearer ${TOKEN}`);
    });

    it.each([
        ["pair", (c) => c.pair("hash")],
        ["unpair", (c) => c.unpair()],
        ["hosts", (c) => c.hosts()],
    ])("nunca envia o token em %s, mesmo com o cliente pareado", async (_name, call) => {
        const fetchImpl = recordingFetch();
        await call(createSyncClient({ token: TOKEN, fetchImpl }));
        expect(headersOf(fetchImpl)).not.toHaveProperty("Authorization");
    });
});

describe("syncClient — formato das requisições", () => {
    it("serializa o push como POST com deviceId e changes", async () => {
        const fetchImpl = recordingFetch();
        const changes = [{ entity: "task", id: "a", envelope: { v: 1 } }];
        await createSyncClient({ token: TOKEN, fetchImpl }).push("device-1", changes);
        const [url, init] = fetchImpl.mock.calls[0];
        expect(url).toBe("/api/sync/push");
        expect(init.method).toBe("POST");
        expect(JSON.parse(init.body)).toEqual({ deviceId: "device-1", changes });
    });

    it("envia pair sem reset por padrão", async () => {
        const fetchImpl = recordingFetch();
        await createSyncClient({ fetchImpl }).pair("hash");
        expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({ authHash: "hash", reset: false });
    });

    it("não envia corpo em requisições GET", async () => {
        const fetchImpl = recordingFetch();
        await createSyncClient({ token: TOKEN, fetchImpl }).pull(42, 500);
        const [url, init] = fetchImpl.mock.calls[0];
        expect(url).toBe("/api/sync/pull?since=42&limit=500");
        expect(init.method).toBe("GET");
        expect(init.body).toBeUndefined();
    });

    it("codifica o storeId na query de waitForChanges", async () => {
        const fetchImpl = recordingFetch();
        await createSyncClient({ token: TOKEN, fetchImpl }).waitForChanges(7, "a b&c=d");
        expect(fetchImpl.mock.calls[0][0]).toBe("/api/sync/changes?since=7&store_id=a%20b%26c%3Dd");
    });

    it("devolve o JSON da resposta em caso de sucesso", async () => {
        const fetchImpl = recordingFetch(jsonResponse({ cursor: 9, storeId: "s" }));
        await expect(createSyncClient({ token: TOKEN, fetchImpl }).status()).resolves.toEqual({ cursor: 9, storeId: "s" });
    });
});

describe("syncClient — classificação de erros", () => {
    it.each([
        [401, "unauthorized"],
        [412, "server_unpaired"],
        [409, "conflict"],
        [500, "server_error"],
        [503, "server_error"],
    ])("HTTP %i vira SyncHttpError do tipo %s com o status preservado", async (status, kind) => {
        const fetchImpl = recordingFetch(jsonResponse({}, status));
        const error = await createSyncClient({ token: TOKEN, fetchImpl }).status().catch((e) => e);
        expect(error).toBeInstanceOf(SyncHttpError);
        expect(error).toMatchObject({ kind, status });
    });

    it("falha de rede vira o tipo offline", async () => {
        const fetchImpl = vi.fn(async () => { throw new TypeError("Failed to fetch"); });
        const error = await createSyncClient({ token: TOKEN, fetchImpl }).status().catch((e) => e);
        expect(error).toBeInstanceOf(SyncHttpError);
        expect(error.kind).toBe("offline");
    });
});

describe("syncClient — cancelamento e timeout", () => {
    it("aborta a requisição quando o sinal externo é abortado", async () => {
        const fetchImpl = hangingFetch();
        const external = new AbortController();
        const pending = createSyncClient({ token: TOKEN, fetchImpl }).waitForChanges(0, "s", external.signal);
        external.abort();
        await expect(pending).rejects.toMatchObject({ kind: "offline" });
        expect(fetchImpl.mock.calls[0][1].signal.aborted).toBe(true);
    });

    it("já nasce abortada se o sinal externo chegou abortado", async () => {
        const fetchImpl = hangingFetch();
        const external = new AbortController();
        external.abort();
        await expect(createSyncClient({ token: TOKEN, fetchImpl }).waitForChanges(0, "s", external.signal))
            .rejects.toMatchObject({ kind: "offline" });
    });

    it("aborta requisições comuns após 15 segundos", async () => {
        vi.useFakeTimers();
        const fetchImpl = hangingFetch();
        const pending = createSyncClient({ token: TOKEN, fetchImpl }).status().catch((e) => e);
        await vi.advanceTimersByTimeAsync(14_999);
        expect(fetchImpl.mock.calls[0][1].signal.aborted).toBe(false);
        await vi.advanceTimersByTimeAsync(1);
        expect((await pending).kind).toBe("offline");
    });

    it("dá 30 segundos ao long polling de waitForChanges", async () => {
        vi.useFakeTimers();
        const fetchImpl = hangingFetch();
        const pending = createSyncClient({ token: TOKEN, fetchImpl }).waitForChanges(0, "s").catch((e) => e);
        await vi.advanceTimersByTimeAsync(29_999);
        expect(fetchImpl.mock.calls[0][1].signal.aborted).toBe(false);
        await vi.advanceTimersByTimeAsync(1);
        expect((await pending).kind).toBe("offline");
    });
});
