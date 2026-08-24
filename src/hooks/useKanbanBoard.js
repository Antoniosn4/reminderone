// =============================================================
//  useKanbanBoard.js
//  Estado centralizado do Kanban via useReducer.
//  Estrutura normalizada (colunas + cards separados) otimizada
//  para persistência futura em IndexedDB.
//  Persistido via usePersistedState (AES-GCM em localStorage).
// =============================================================

import { useCallback, useMemo } from "react";
import { usePersistedState } from "./usePersistedState";
import { generateId } from "../utils/id";

const STORAGE_KEY = "reminder_kanban_board";

const DEFAULT_BOARD = {
    columnOrder: ["col-default-1", "col-default-2", "col-default-3"],
    columns: {
        "col-default-1": { id: "col-default-1", title: "Falta Fazer", cardIds: [] },
        "col-default-2": { id: "col-default-2", title: "Fazendo", cardIds: [] },
        "col-default-3": { id: "col-default-3", title: "Feito", cardIds: [] },
    },
    cards: {},
};

function boardReducer(state, action) {
    switch (action.type) {
        case "REORDER_CARD": {
            const { sourceColId, destColId, sourceIndex, destIndex } = action;
            const sourceCol = state.columns[sourceColId];
            const destCol = state.columns[destColId];
            if (!sourceCol || !destCol) return state;

            if (sourceColId === destColId) {
                const newIds = [...sourceCol.cardIds];
                const [moved] = newIds.splice(sourceIndex, 1);
                newIds.splice(destIndex, 0, moved);
                return {
                    ...state,
                    columns: {
                        ...state.columns,
                        [sourceColId]: { ...sourceCol, cardIds: newIds },
                    },
                };
            }

            const srcIds = [...sourceCol.cardIds];
            const dstIds = [...destCol.cardIds];
            const [moved] = srcIds.splice(sourceIndex, 1);
            dstIds.splice(destIndex, 0, moved);
            return {
                ...state,
                columns: {
                    ...state.columns,
                    [sourceColId]: { ...sourceCol, cardIds: srcIds },
                    [destColId]: { ...destCol, cardIds: dstIds },
                },
            };
        }

        case "REORDER_COLUMN": {
            const { sourceIndex, destIndex } = action;
            const newOrder = [...state.columnOrder];
            const [moved] = newOrder.splice(sourceIndex, 1);
            newOrder.splice(destIndex, 0, moved);
            return { ...state, columnOrder: newOrder };
        }

        case "ADD_COLUMN": {
            const id = `col-${generateId()}`;
            return {
                ...state,
                columnOrder: [...state.columnOrder, id],
                columns: {
                    ...state.columns,
                    [id]: { id, title: action.title || "Nova Coluna", cardIds: [] },
                },
            };
        }

        case "UPDATE_COLUMN_TITLE": {
            const col = state.columns[action.columnId];
            if (!col) return state;
            return {
                ...state,
                columns: {
                    ...state.columns,
                    [action.columnId]: { ...col, title: action.title },
                },
            };
        }

        case "DELETE_COLUMN": {
            const col = state.columns[action.columnId];
            if (!col) return state;
            const nextCards = { ...state.cards };
            col.cardIds.forEach((cid) => delete nextCards[cid]);
            const { [action.columnId]: _, ...restCols } = state.columns;
            return {
                ...state,
                columnOrder: state.columnOrder.filter((id) => id !== action.columnId),
                columns: restCols,
                cards: nextCards,
            };
        }

        case "ADD_CARD": {
            const col = state.columns[action.columnId];
            if (!col) return state;
            const id = `card-${generateId()}`;
            return {
                ...state,
                columns: {
                    ...state.columns,
                    [action.columnId]: { ...col, cardIds: [...col.cardIds, id] },
                },
                cards: {
                    ...state.cards,
                    [id]: {
                        id,
                        title: action.title || "",
                        description: action.description || "",
                        color: action.color || null,
                        createdAt: Date.now(),
                    },
                },
            };
        }

        case "UPDATE_CARD": {
            const card = state.cards[action.cardId];
            if (!card) return state;
            return {
                ...state,
                cards: {
                    ...state.cards,
                    [action.cardId]: { ...card, ...action.updates },
                },
            };
        }

        case "DELETE_CARD": {
            const { [action.cardId]: _, ...restCards } = state.cards;
            const nextColumns = {};
            for (const [colId, col] of Object.entries(state.columns)) {
                nextColumns[colId] = {
                    ...col,
                    cardIds: col.cardIds.filter((cid) => cid !== action.cardId),
                };
            }
            return { ...state, columns: nextColumns, cards: restCards };
        }

        case "HYDRATE":
            return action.board;

        default:
            return state;
    }
}

export function useKanbanBoard() {
    const [board, setBoard, hydrated] = usePersistedState(STORAGE_KEY, DEFAULT_BOARD);

    const dispatch = useCallback((action) => {
        setBoard((prev) => {
            const safe = (prev && prev.columnOrder) ? prev : DEFAULT_BOARD;
            return boardReducer(safe, action);
        });
    }, [setBoard]);

    const actions = useMemo(() => ({
        reorderCard(sourceColId, destColId, sourceIndex, destIndex) {
            dispatch({ type: "REORDER_CARD", sourceColId, destColId, sourceIndex, destIndex });
        },
        reorderColumn(sourceIndex, destIndex) {
            dispatch({ type: "REORDER_COLUMN", sourceIndex, destIndex });
        },
        addColumn(title) {
            dispatch({ type: "ADD_COLUMN", title });
        },
        updateColumnTitle(columnId, title) {
            dispatch({ type: "UPDATE_COLUMN_TITLE", columnId, title });
        },
        deleteColumn(columnId) {
            dispatch({ type: "DELETE_COLUMN", columnId });
        },
        addCard(columnId, title, description) {
            dispatch({ type: "ADD_CARD", columnId, title, description });
        },
        updateCard(cardId, updates) {
            dispatch({ type: "UPDATE_CARD", cardId, updates });
        },
        deleteCard(cardId) {
            dispatch({ type: "DELETE_CARD", cardId });
        },
    }), [dispatch]);

    const safeBoard = (board && board.columnOrder) ? board : DEFAULT_BOARD;

    return { board: safeBoard, actions, hydrated };
}
