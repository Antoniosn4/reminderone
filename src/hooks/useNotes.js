// =============================================================
//  useNotes.js
//  Custom Hook — CRUD completo das anotações, sobre o armazenamento
//  de registros (sincronizado com o celular).
//
//  Cada anotação: id, title, content, color (blue|rose|emerald|
//  violet|amber|gray), completed, createdAt, updatedAt — e parentId,
//  a hierarquia que o celular mostra em árvore (aqui a grade é plana).
// =============================================================

import { useCallback, useMemo } from "react";
import { useCollection, useData } from "../data/DataContext";
import { noteToDesktop } from "../data/mappers";
import { generateId } from "../utils/id";

/**
 * @returns {{
 *   notes: Array,
 *   addNote: (data: {title: string, content: string, color: string}) => void,
 *   updateNote: (id: string, updates: object) => void,
 *   deleteNote: (id: string) => void,
 *   toggleNoteCompletion: (id: string) => void,
 * }}
 */
export function useNotes() {
    const { store } = useData();
    const records = useCollection("note");
    const notes = useMemo(
        () => records.map(noteToDesktop).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
        [records],
    );

    const addNote = useCallback((data) => {
        const position = store.list("note").reduce((max, note) => Math.max(max, note.position ?? 0), 0) + 1;
        store.write("note", `note_${generateId()}`, {
            title: data.title?.trim() || "Sem título",
            content: data.content?.trim() || "",
            color: data.color || "gray",
            completed: false,
            parentId: null,
            position,
            createdAt: new Date().toISOString(),
        });
    }, [store]);

    const updateNote = useCallback((id, updates) => {
        if (!store.get("note", id)) return;
        const changes = {};
        if (updates.title !== undefined) changes.title = String(updates.title).trim() || "Sem título";
        if (updates.content !== undefined) changes.content = String(updates.content).trim();
        if (updates.color !== undefined) changes.color = updates.color;
        if (updates.completed !== undefined) changes.completed = !!updates.completed;
        store.write("note", id, changes);
    }, [store]);

    const deleteNote = useCallback((id) => {
        const note = store.get("note", id);
        if (!note) return;
        store.batch(() => {
            // As filhas (criadas no celular) sobem para o pai da nota excluída.
            for (const child of store.list("note")) {
                if (child.parentId === id) store.write("note", child.id, { parentId: note.parentId ?? null });
            }
            store.remove("note", id);
        });
    }, [store]);

    const toggleNoteCompletion = useCallback((id) => {
        const note = store.get("note", id);
        if (note) store.write("note", id, { completed: !note.completed });
    }, [store]);

    return { notes, addNote, updateNote, deleteNote, toggleNoteCompletion };
}
