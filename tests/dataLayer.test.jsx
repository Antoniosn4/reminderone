// =============================================================
//  dataLayer.test.jsx
//  Conversão desktop ↔ protocolo, importação dos dados de antes e
//  os hooks de tarefas e Kanban sobre o armazenamento de registros.
// =============================================================

import { describe, it, expect } from "vitest";
import { act } from "@testing-library/react";
import { desktopTaskChanges, localDateISO, positionBetween, taskToDesktop } from "../src/data/mappers";
import { importLegacyData } from "../src/data/legacyImport";
import { useTasks } from "../src/hooks/useTasks";
import { useKanbanBoard, useKanbanFolders } from "../src/hooks/useKanban";
import { openStore } from "./support/syncKit";
import { renderDataHook } from "./support/renderWithData";

describe("mappers", () => {
    const projects = new Map([
        ["p1", { id: "p1", name: "Frontend", color: "#3b82f6", parentId: null }],
        ["p1s", { id: "p1s", name: "Design System", parentId: "p1" }],
    ]);

    it("registro do protocolo vira a tarefa do desktop", () => {
        const task = taskToDesktop(
            {
                id: "t1",
                projectId: "p1s",
                title: "Tokens",
                dueDate: "2026-10-12",
                dueTime: null,
                priority: "medium",
                status: "in_progress",
                tags: ["ui"],
                updatedAt: "2026-10-11T12:00:00.000Z",
            },
            projects,
        );
        expect(task).toMatchObject({
            project: "Frontend",
            projectColor: "#3b82f6",
            subProject: "Design System",
            time: "Sem horário",
            priority: "normal",
            completed: false,
            status: "in_progress",
            tags: ["ui"],
        });
    });

    it("projeto desconhecido ou Entrada aparecem como Entrada", () => {
        expect(taskToDesktop({ id: "t", projectId: "sumiu" }, projects).project).toBe("Entrada");
        expect(taskToDesktop({ id: "t", projectId: "inbox" }, projects).project).toBe("Entrada");
    });

    it("campos do desktop viram campos do protocolo, só os informados", () => {
        const changes = desktopTaskChanges(
            { title: " Revisar ", time: "Sem horário", priority: "urgent", completed: true, project: "Frontend", subProject: "Design System" },
            { resolveProjectId: (label, sub) => `${label}/${sub}`, current: { status: "in_progress" }, now: () => "AGORA" },
        );
        expect(changes).toEqual({
            title: "Revisar",
            dueTime: null,
            priority: "urgent",
            status: "done",
            completedAt: "AGORA",
            projectId: "Frontend/Design System",
        });
    });

    it("reabrir uma tarefa feita volta para A fazer", () => {
        const changes = desktopTaskChanges({ completed: false }, { resolveProjectId: () => "x", current: { status: "done" } });
        expect(changes).toEqual({ status: "todo", completedAt: null });
    });

    it("data local, não UTC", () => {
        expect(localDateISO(new Date(2026, 9, 11, 23, 30))).toBe("2026-10-11");
        expect(positionBetween(1, 2)).toBe(1.5);
    });
});

describe("importação dos dados de antes", () => {
    const sources = {
        loadTasks: async () => [
            { id: 1, title: "Antiga", project: "Frontend", subProject: "Componentes", projectColor: "#3b82f6", date: "2026-09-01", time: "09:00", priority: "high", completed: true, completedAt: "2026-09-01T10:00:00.000Z", tags: ["x"] },
            { id: 2, title: "Na entrada", project: "Entrada", time: "Sem horário", priority: "normal" },
            { id: 3, title: "Ideia", project: "Ideias de Produto" },
        ],
        readCollection: async (key) => ({
            "reminder-custom-projects-encrypted": [{ id: "frontend", label: "Frontend", color: "#3b82f6", subProjects: [{ id: "frontend_comp", label: "Componentes" }] }],
            reminder_kanban_board: {
                columnOrder: ["c1"],
                columns: { c1: { id: "c1", title: "Falta Fazer", cardIds: ["k1"] } },
                cards: { k1: { id: "k1", title: "Cartão", description: "", color: null, createdAt: 1759000000000 } },
            },
            reminder_notes: [{ id: "note_1", title: "Nota", content: "Texto", color: "blue", completed: false }],
            "reminder-routines-encrypted": [{ id: "routine_1", label: "Água", time: "09:00", completedDates: ["2026-10-10"] }],
        })[key] ?? null,
        loadProfile: () => ({ name: "Antonio", email: "a@b.com" }),
    };

    it("importa tudo uma vez, mantendo ids", async () => {
        const store = openStore();
        expect(await importLegacyData(store, sources)).toBe(true);

        expect(store.get("task", "1")).toMatchObject({ projectId: "frontend_comp", priority: "high", status: "done", dueTime: "09:00" });
        expect(store.get("task", "2")).toMatchObject({ projectId: "inbox", dueTime: null, priority: "medium" });
        expect(store.get("task", "3").projectId).toBe("ideias_produto");
        expect(store.get("kanban_board", "legacy_board")).toMatchObject({ name: "Meu quadro" });
        expect(store.get("kanban_card", "k1")).toMatchObject({ columnId: "c1", boardId: "legacy_board" });
        expect(store.get("note", "note_1")).toMatchObject({ content: "Texto", color: "blue" });
        expect(store.get("routine", "routine_1")).toMatchObject({ completedDates: ["2026-10-10"] });
        expect(store.get("profile", "me")).toMatchObject({ name: "Antonio" });

        // Idempotente: a segunda vez não faz nada.
        expect(await importLegacyData(store, sources)).toBe(false);
    });
});

describe("useTasks", () => {
    it("cria pelo formulário, edita, conclui e exclui", async () => {
        const { result, store } = renderDataHook(() => useTasks());
        await act(async () => {
            await result.current.addTaskManual({ title: "Relatório", project: "Trabalho", priority: "high" });
        });
        const [task] = result.current.tasks;
        expect(task).toMatchObject({ title: "Relatório", project: "Trabalho", priority: "high", completed: false });
        expect(store.list("project").map((p) => p.name)).toEqual(["Trabalho"]);

        act(() => result.current.updateTask(task.id, { ...task, title: "Relatório final", time: "10:30" }));
        expect(result.current.tasks[0]).toMatchObject({ title: "Relatório final", time: "10:30" });

        act(() => result.current.toggleTask(task.id));
        expect(result.current.tasks[0].completed).toBe(true);

        act(() => result.current.deleteTask(task.id));
        expect(result.current.tasks).toEqual([]);
    });
});

describe("Kanban em pastas", () => {
    it("pasta nova com 3 colunas; cartões movem e a exclusão leva tudo", () => {
        const store = openStore();
        const folders = renderDataHook(() => useKanbanFolders(), store);
        let boardId;
        act(() => {
            boardId = folders.result.current.createBoard("Tráfego pago", "#ef4444");
        });
        expect(folders.result.current.folders).toEqual([
            expect.objectContaining({ name: "Tráfego pago", color: "#ef4444", columnCount: 3, cardCount: 0 }),
        ]);

        const board = renderDataHook(() => useKanbanBoard(boardId), store);
        const [todo, doing] = board.result.current.board.columnOrder;
        act(() => board.result.current.actions.addCard(todo, "Campanha A"));
        act(() => board.result.current.actions.addCard(todo, "Campanha B"));
        act(() => board.result.current.actions.reorderCard(todo, doing, 1, 0));
        act(() => board.result.current.actions.reorderCard(todo, todo, 0, 0));

        const view = board.result.current.board;
        expect(view.columns[todo].cardIds.map((id) => view.cards[id].title)).toEqual(["Campanha A"]);
        expect(view.columns[doing].cardIds.map((id) => view.cards[id].title)).toEqual(["Campanha B"]);

        act(() => board.result.current.actions.reorderColumn(0, 2));
        expect(board.result.current.board.columnOrder.map((id) => board.result.current.board.columns[id].title))
            .toEqual(["Fazendo", "Feito", "A fazer"]);

        act(() => folders.result.current.removeBoard(boardId));
        expect(folders.result.current.folders).toEqual([]);
        expect(store.list("kanban_card")).toEqual([]);
        expect(store.list("kanban_column")).toEqual([]);
    });
});
