// =============================================================
//  useKanban.js
//  Kanban em pastas, sobre o armazenamento de registros
//  (sincronizado com o celular):
//   - useKanbanFolders: as pastas (cards como "Tráfego pago") com
//     criar, renomear/cor, reordenar e excluir em cascata;
//   - useKanbanBoard: o quadro de uma pasta no formato da KanbanView
//     ({ columnOrder, columns, cards }) e as ações dela. Mover grava
//     só o item movido, com uma posição entre as dos vizinhos.
// =============================================================

import { useCallback, useMemo } from "react";
import { useCollection, useData } from "../data/DataContext";
import { boardToDesktop, byPosition, DEFAULT_COLUMN_TITLES, positionBetween } from "../data/mappers";
import { generateId } from "../utils/id";

const lastPosition = (items) => items.reduce((max, item) => Math.max(max, item.position ?? 0), 0);

/** Exclui a coluna e os cartões dela (dentro de um batch). */
function removeColumnCascade(store, columnId) {
    for (const card of store.list("kanban_card")) {
        if (card.columnId === columnId) store.remove("kanban_card", card.id);
    }
    store.remove("kanban_column", columnId);
}

export function useKanbanFolders() {
    const { store } = useData();
    const boards = useCollection("kanban_board");
    const columns = useCollection("kanban_column");
    const cards = useCollection("kanban_card");

    const folders = useMemo(() => {
        const liveColumns = new Set(columns.map((column) => column.id));
        return [...boards].sort(byPosition).map((board) => ({
            id: board.id,
            name: board.name ?? "",
            color: board.color ?? null,
            columnCount: columns.filter((column) => column.boardId === board.id).length,
            cardCount: cards.filter((card) => card.boardId === board.id && liveColumns.has(card.columnId)).length,
        }));
    }, [boards, columns, cards]);

    const createBoard = useCallback((name, color = null) => {
        const trimmed = String(name ?? "").trim();
        if (!trimmed) return null;
        const id = `board-${generateId()}`;
        const now = new Date().toISOString();
        store.batch(() => {
            store.write("kanban_board", id, { name: trimmed, color, position: lastPosition(store.list("kanban_board")) + 1, createdAt: now });
            DEFAULT_COLUMN_TITLES.forEach((title, index) => {
                store.write("kanban_column", `col-${generateId()}`, { boardId: id, title, position: index + 1, createdAt: now });
            });
        });
        return id;
    }, [store]);

    const updateBoard = useCallback((id, { name, color }) => {
        if (!store.get("kanban_board", id)) return;
        const changes = {};
        if (name !== undefined) {
            const trimmed = String(name).trim();
            if (!trimmed) return;
            changes.name = trimmed;
        }
        if (color !== undefined) changes.color = color;
        store.write("kanban_board", id, changes);
    }, [store]);

    /** Troca a pasta de lugar com a vizinha. */
    const moveBoard = useCallback((id, direction) => {
        const ordered = [...store.list("kanban_board")].sort(byPosition);
        const from = ordered.findIndex((board) => board.id === id);
        const to = direction === "back" ? from - 1 : from + 1;
        if (from === -1 || to < 0 || to >= ordered.length) return;
        const [a, b] = [ordered[from], ordered[to]];
        const posA = a.position === b.position ? b.position + (to > from ? 1 : -1) : b.position;
        store.batch(() => {
            store.write("kanban_board", a.id, { position: posA });
            store.write("kanban_board", b.id, { position: a.position });
        });
    }, [store]);

    const removeBoard = useCallback((id) => {
        store.batch(() => {
            for (const column of store.list("kanban_column")) {
                if (column.boardId === id) removeColumnCascade(store, column.id);
            }
            for (const card of store.list("kanban_card")) {
                if (card.boardId === id) store.remove("kanban_card", card.id);
            }
            store.remove("kanban_board", id);
        });
    }, [store]);

    return { folders, createBoard, updateBoard, moveBoard, removeBoard };
}

export function useKanbanBoard(boardId) {
    const { store } = useData();
    const boards = useCollection("kanban_board");
    const columns = useCollection("kanban_column");
    const cards = useCollection("kanban_card");

    const folder = useMemo(() => boards.find((board) => board.id === boardId) ?? null, [boards, boardId]);
    const board = useMemo(() => boardToDesktop(boardId, columns, cards), [boardId, columns, cards]);

    const actions = useMemo(() => {
        const columnsOfBoard = () => store.list("kanban_column").filter((c) => c.boardId === boardId).sort(byPosition);
        const cardsOfColumn = (columnId) => store.list("kanban_card").filter((c) => c.columnId === columnId).sort(byPosition);

        return {
            reorderCard(sourceColId, destColId, sourceIndex, destIndex) {
                const moving = cardsOfColumn(sourceColId)[sourceIndex];
                if (!moving) return;
                const others = cardsOfColumn(destColId).filter((card) => card.id !== moving.id);
                const position = positionBetween(others[destIndex - 1]?.position ?? null, others[destIndex]?.position ?? null);
                store.write("kanban_card", moving.id, { columnId: destColId, position });
            },
            reorderColumn(sourceIndex, destIndex) {
                const ordered = columnsOfBoard();
                const moving = ordered[sourceIndex];
                if (!moving) return;
                const others = ordered.filter((column) => column.id !== moving.id);
                const position = positionBetween(others[destIndex - 1]?.position ?? null, others[destIndex]?.position ?? null);
                store.write("kanban_column", moving.id, { position });
            },
            addColumn(title) {
                store.write("kanban_column", `col-${generateId()}`, {
                    boardId,
                    title: String(title ?? "").trim() || "Nova Coluna",
                    position: lastPosition(columnsOfBoard()) + 1,
                    createdAt: new Date().toISOString(),
                });
            },
            updateColumnTitle(columnId, title) {
                const trimmed = String(title ?? "").trim();
                if (trimmed) store.write("kanban_column", columnId, { title: trimmed });
            },
            deleteColumn(columnId) {
                store.batch(() => removeColumnCascade(store, columnId));
            },
            addCard(columnId, title, description = "") {
                const trimmed = String(title ?? "").trim();
                if (!trimmed) return;
                store.write("kanban_card", `card-${generateId()}`, {
                    boardId,
                    columnId,
                    title: trimmed,
                    description,
                    color: null,
                    position: lastPosition(cardsOfColumn(columnId)) + 1,
                    createdAt: new Date().toISOString(),
                });
            },
            updateCard(cardId, updates) {
                const changes = {};
                for (const field of ["title", "description", "color"]) {
                    if (updates[field] !== undefined) changes[field] = updates[field];
                }
                store.write("kanban_card", cardId, changes);
            },
            deleteCard(cardId) {
                store.remove("kanban_card", cardId);
            },
        };
    }, [store, boardId]);

    return { folder, board, actions };
}
