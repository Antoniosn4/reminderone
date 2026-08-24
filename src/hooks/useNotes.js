// =============================================================
//  useNotes.js
//  Custom Hook — CRUD completo para anotações pessoais.
//  Persistência cifrada via usePersistedState (AES-GCM).
//
//  Cada anotação possui:
//    - id: string (note_<timestamp>)
//    - title: string
//    - content: string
//    - color: string (blue|rose|emerald|violet|amber|gray)
//    - completed: boolean (arquivada/concluída)
//    - createdAt: string (ISO)
//    - updatedAt: string (ISO)
// =============================================================

import { useCallback } from "react";
import { usePersistedState } from "./usePersistedState";

const STORAGE_KEY = "reminder_notes";

function makeNoteId() {
    return `note_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function nowISO() {
    return new Date().toISOString();
}

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
    const [notes, setNotes] = usePersistedState(STORAGE_KEY, []);

    const addNote = useCallback((data) => {
        const now = nowISO();
        const note = {
            id: makeNoteId(),
            title: data.title?.trim() || "Sem título",
            content: data.content?.trim() || "",
            color: data.color || "gray",
            completed: false,
            createdAt: now,
            updatedAt: now,
        };
        setNotes((prev) => [note, ...prev]);
    }, [setNotes]);

    const updateNote = useCallback((id, updates) => {
        setNotes((prev) =>
            prev.map((n) =>
                n.id === id
                    ? { ...n, ...updates, updatedAt: nowISO() }
                    : n
            )
        );
    }, [setNotes]);

    const deleteNote = useCallback((id) => {
        setNotes((prev) => prev.filter((n) => n.id !== id));
    }, [setNotes]);

    const toggleNoteCompletion = useCallback((id) => {
        setNotes((prev) =>
            prev.map((n) =>
                n.id === id
                    ? { ...n, completed: !n.completed, updatedAt: nowISO() }
                    : n
            )
        );
    }, [setNotes]);

    return { notes, addNote, updateNote, deleteNote, toggleNoteCompletion };
}
