// =============================================================
//  dataSync.test.js
//  Armazenamento de registros + motor de sincronização do desktop,
//  contra um servidor em memória com a regra do servidor real.
// =============================================================

import { describe, it, expect, beforeEach } from "vitest";
import { createSyncEngine } from "../src/data/syncEngine";
import { createSyncCipher, aadFor } from "../src/data/syncCrypto";
import { createMemoryPersistence } from "../src/data/persistence";
import { createDataStore } from "../src/data/dataStore";
import { createFakeSyncServer, openStore, plainVaultCipher } from "./support/syncKit";

const KEY_HEX = "11".repeat(32);

async function device(server, start) {
    const store = openStore({ start });
    const engine = createSyncEngine({
        store,
        client: server.client(),
        cipher: await createSyncCipher(KEY_HEX),
        deviceId: start,
        batchSize: 3,
        pageSize: 4,
    });
    return { store, engine };
}

describe("dataStore", () => {
    it("grava por cima do que já existe e marca pendente com versão", () => {
        const store = openStore();
        store.write("task", "t1", { title: "A", tags: ["x"] });
        store.write("task", "t1", { title: "B" });

        expect(store.get("task", "t1")).toMatchObject({ title: "B", tags: ["x"] });
        const [entry] = store.dirtyEntries();
        expect(entry).toMatchObject({ entity: "task", id: "t1" });
        // Versão velha não limpa a pendência; a atual limpa.
        expect(store.clearDirty("task", "t1", entry.version - 1)).toBe(false);
        expect(store.clearDirty("task", "t1", entry.version)).toBe(true);
        expect(store.dirtyEntries()).toEqual([]);
    });

    it("updatedAt sempre avança, mesmo com o relógio parado", () => {
        const store = createDataStore({ persistence: createMemoryPersistence(), vaultCipher: plainVaultCipher, clock: () => 1000 });
        const first = store.write("note", "n1", { title: "A" }).updatedAt;
        const second = store.write("note", "n1", { title: "B" }).updatedAt;
        expect(second > first).toBe(true);
    });

    it("exclusão é lápide; registro remoto não gera pendência", () => {
        const store = openStore();
        store.write("task", "t1", { title: "A" });
        store.remove("task", "t1");
        expect(store.get("task", "t1")).toBeNull();
        expect(store.getRecord("task", "t1")).toMatchObject({ deleted: true });

        store.applyRemote({ entity: "task", id: "t2", updatedAt: "2026-10-11T12:00:00.000Z", deleted: false, data: { title: "remota" } });
        expect(store.isDirty("task", "t2")).toBe(false);
        expect(store.list("task").map((t) => t.title)).toEqual(["remota"]);
    });

    it("persiste e recarrega (com a cifra do cofre)", async () => {
        const persistence = createMemoryPersistence();
        const first = createDataStore({ persistence, vaultCipher: plainVaultCipher });
        first.write("routine", "r1", { label: "Vitaminas" });
        first.setMeta("cursor", 7);
        await first.flushed();

        const second = createDataStore({ persistence, vaultCipher: plainVaultCipher });
        await second.load();
        expect(second.get("routine", "r1")).toMatchObject({ label: "Vitaminas" });
        expect(second.isDirty("routine", "r1")).toBe(true);
        expect(second.getMeta("cursor")).toBe(7);
    });

    it("avisa uma vez por batch, dizendo se houve escrita local", () => {
        const store = openStore();
        const events = [];
        store.subscribe((event) => events.push(event));
        store.batch(() => {
            store.write("kanban_board", "b1", { name: "Pasta" });
            store.write("kanban_column", "c1", { boardId: "b1", title: "A fazer" });
        });
        store.applyRemote({ entity: "note", id: "n", updatedAt: "2026-10-11T12:00:00.000Z", deleted: false, data: {} });
        expect(events).toHaveLength(2);
        expect(events[0].origin).toBe("local");
        expect([...events[0].entities].sort()).toEqual(["kanban_board", "kanban_column"]);
        expect(events[1].origin).toBe("remote");
    });
});

describe("sincronização entre dois desktops (ou desktop e celular)", () => {
    let server;
    let a;
    let b;

    beforeEach(async () => {
        server = createFakeSyncServer();
        a = await device(server, "2026-10-11T12:00:00.000Z");
        b = await device(server, "2026-10-11T12:00:00.500Z");
    });

    async function syncAll() {
        await a.engine.sync();
        await b.engine.sync();
        await a.engine.sync();
    }

    it("cria, edita e exclui nos dois sentidos", async () => {
        a.store.write("task", "t1", { title: "Pagar luz", status: "todo", projectId: "inbox" });
        await syncAll();
        expect(b.store.get("task", "t1")).toMatchObject({ title: "Pagar luz" });

        b.store.write("task", "t1", { status: "done" });
        await syncAll();
        expect(a.store.get("task", "t1")).toMatchObject({ status: "done" });

        a.store.remove("task", "t1");
        await syncAll();
        expect(b.store.get("task", "t1")).toBeNull();
        expect(server.get("task", "t1").deleted).toBe(true);
    });

    it("preserva no envio os campos que só o outro app conhece", async () => {
        const cipher = await createSyncCipher(KEY_HEX);
        const record = { entity: "task", id: "m1", updatedAt: "2026-10-11T11:00:00.000Z", deleted: false };
        server.put({ ...record, payload: await cipher.encrypt(aadFor(record), JSON.stringify({ title: "Do celular", origin: "voice", status: "in_progress" })) });

        await a.engine.sync();
        a.store.write("task", "m1", { title: "Editado no desktop" });
        await a.engine.sync();

        const stored = server.get("task", "m1");
        const decoded = JSON.parse(await cipher.decrypt(aadFor(stored), stored.payload));
        expect(decoded).toEqual({ title: "Editado no desktop", origin: "voice", status: "in_progress" });
    });

    it("no conflito vale a versão mais recente", async () => {
        a.store.write("note", "n1", { title: "Original" });
        await syncAll();
        const fromA = a.store.write("note", "n1", { title: "Do A" });
        const fromB = b.store.write("note", "n1", { title: "Do B" });
        const winner = fromA.updatedAt > fromB.updatedAt ? "Do A" : "Do B";
        await syncAll();
        await b.engine.sync();
        expect(a.store.get("note", "n1").title).toBe(winner);
        expect(b.store.get("note", "n1").title).toBe(winner);
    });

    it("muitos registros passam em lotes e páginas", async () => {
        a.store.batch(() => {
            for (let i = 0; i < 10; i += 1) a.store.write("kanban_card", `c${i}`, { title: `Cartão ${i}`, position: i });
        });
        await syncAll();
        expect(b.store.list("kanban_card")).toHaveLength(10);
        expect(a.store.dirtyEntries()).toEqual([]);
    });

    it("servidor que trocou de banco recebe tudo de novo", async () => {
        a.store.write("routine", "r1", { label: "Água" });
        await a.engine.sync();
        server.reset();
        await a.engine.sync();
        expect([...server.records.keys()]).toEqual(["routine:r1"]);
    });

    it("a Entrada nunca vai para o servidor", async () => {
        a.store.write("project", "inbox", { name: "Entrada" });
        await a.engine.sync();
        expect(server.get("project", "inbox")).toBeNull();
    });
});
