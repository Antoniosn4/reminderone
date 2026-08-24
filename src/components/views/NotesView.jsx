// =============================================================
//  NotesView.jsx
//  Grid de anotações com card de criação rápida.
//  Suporta: preview de conteúdo, toggle (arquivar), edição e
//  exclusão inline com feedback visual.
// =============================================================

import { useMemo } from "react";
import {
    Plus, CheckSquare, RefreshCw, Pencil, Trash2, StickyNote,
} from "lucide-react";
import { EmptyState } from "../EmptyState";

/** Mapeia nomes de cor para classes Tailwind consistentes. */
const COLOR_MAP = {
    blue:    "bg-blue-500/10 border-blue-500/20 text-blue-400 hover:border-blue-500/40",
    rose:    "bg-rose-500/10 border-rose-500/20 text-rose-400 hover:border-rose-500/40",
    emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:border-emerald-500/40",
    violet:  "bg-violet-500/10 border-violet-500/20 text-violet-400 hover:border-violet-500/40",
    amber:   "bg-amber-500/10 border-amber-500/20 text-amber-400 hover:border-amber-500/40",
    gray:    "bg-gray-800/60 border-gray-700 text-gray-300 hover:border-gray-500",
};

function getColorClasses(colorName) {
    return COLOR_MAP[colorName] || COLOR_MAP.gray;
}

/** Formata data ISO como "DD Mmm" legível. */
function formatRelativeDate(isoDate) {
    if (!isoDate) return "";
    try {
        const date = new Date(isoDate);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return "Hoje";
        if (diffDays === 1) return "Ontem";
        if (diffDays < 7) return `${diffDays} dias atrás`;

        return date.toLocaleDateString("pt-BR", {
            day: "numeric",
            month: "short",
        }).replace(/\.$/, "");
    } catch {
        return "";
    }
}

/**
 * @param {{
 *   notes: Array,
 *   onAdd: () => void,
 *   onEdit: (note: object) => void,
 *   onDelete: (id: string) => void,
 *   onToggle: (id: string) => void,
 * }} props
 */
export function NotesView({ notes, onAdd, onEdit, onDelete, onToggle }) {
    const activeNotes = useMemo(
        () => notes.filter((n) => !n.completed),
        [notes],
    );
    const archivedNotes = useMemo(
        () => notes.filter((n) => n.completed),
        [notes],
    );

    return (
        <div className="pt-2 pb-10 w-full max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                {/* Card de Adição Rápida */}
                <button
                    type="button"
                    onClick={onAdd}
                    className="bg-gray-800/40 border border-dashed border-gray-600 rounded-3xl p-6 min-h-[220px] flex flex-col items-center justify-center cursor-pointer hover:bg-gray-800/80 transition-all group text-left"
                >
                    <div className="w-12 h-12 rounded-full bg-gray-700/50 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-gray-700 group-hover:text-gray-200 transition-all text-gray-400">
                        <Plus className="w-6 h-6" />
                    </div>
                    <h3 className="text-gray-300 font-bold group-hover:text-gray-100 transition-colors">
                        Nova Anotação
                    </h3>
                    <p className="text-xs text-gray-500 mt-2">
                        Criar lista ou nota rápida
                    </p>
                </button>

                {/* Cards Ativos */}
                {activeNotes.map((note) => (
                    <NoteCard
                        key={note.id}
                        note={note}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onToggle={onToggle}
                    />
                ))}
            </div>

            {/* Seção de Arquivadas */}
            {archivedNotes.length > 0 && (
                <div className="mt-10">
                    <h3 className="text-sm font-semibold text-gray-500 border-b border-gray-800 pb-2 mb-6">
                        Arquivadas ({archivedNotes.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 opacity-60 hover:opacity-100 transition-opacity duration-500">
                        {archivedNotes.map((note) => (
                            <NoteCard
                                key={note.id}
                                note={note}
                                onEdit={onEdit}
                                onDelete={onDelete}
                                onToggle={onToggle}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Empty state quando não há nenhuma anotação */}
            {notes.length === 0 && (
                <div className="mt-6 bg-gray-800/20 border border-dashed border-gray-700 rounded-2xl">
                    <EmptyState
                        icon={StickyNote}
                        title="Nenhuma anotação ainda"
                        description="Clique em 'Nova Anotação' para começar a organizar suas ideias, listas e rascunhos."
                    />
                </div>
            )}
        </div>
    );
}

// ── Sub-componente: Card individual ──

function NoteCard({ note, onEdit, onDelete, onToggle }) {
    return (
        <div
            className={`relative rounded-3xl p-6 min-h-[220px] flex flex-col transition-all duration-300 group cursor-pointer border ${getColorClasses(note.color)} ${
                note.completed ? "opacity-60 grayscale" : ""
            }`}
            onClick={() => onEdit(note)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onEdit(note);
                }
            }}
        >
            {/* Header */}
            <div className="flex items-start justify-between mb-4 gap-2">
                <h3
                    className={`font-bold text-lg leading-tight flex-1 min-w-0 truncate ${
                        note.completed ? "line-through" : ""
                    }`}
                >
                    {note.title}
                </h3>
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggle(note.id);
                    }}
                    className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-black/20 transition-all flex-shrink-0"
                    title={note.completed ? "Restaurar" : "Arquivar"}
                >
                    {note.completed ? (
                        <RefreshCw className="w-4 h-4" />
                    ) : (
                        <CheckSquare className="w-4 h-4" />
                    )}
                </button>
            </div>

            {/* Corpo (preview com truncagem) */}
            <div
                className={`flex-1 overflow-hidden ${
                    note.completed ? "line-through" : ""
                }`}
            >
                <p className="text-sm whitespace-pre-wrap opacity-80 leading-relaxed note-clamp">
                    {note.content || "Sem conteúdo."}
                </p>
            </div>

            {/* Footer */}
            <div className="mt-6 flex items-center justify-between border-t border-black/10 pt-4">
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">
                    {formatRelativeDate(note.updatedAt)}
                </span>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onEdit(note);
                        }}
                        className="p-1.5 hover:bg-black/20 rounded-lg transition-colors"
                        title="Editar"
                    >
                        <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(note.id);
                        }}
                        className="p-1.5 hover:bg-red-500/30 hover:text-red-300 rounded-lg transition-colors"
                        title="Excluir"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
        </div>
    );
}
