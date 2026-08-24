// =============================================================
//  KanbanView.jsx
//  Quadro Kanban completo — DnD via @hello-pangea/dnd,
//  CRUD de colunas e cartões, edição inline.
// =============================================================

import { useState, useRef, useEffect, useCallback } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import {
    Plus, GripVertical, Trash2, MoreHorizontal, X, Pencil,
} from "lucide-react";

const CARD_COLORS = [
    null,
    "#8b5cf6",
    "#3b82f6",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#ec4899",
];

// ── Inline Editable Text ─────────────────────────────────────

function InlineEdit({ value, onSave, className = "", tag = "input", placeholder = "" }) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(value);
    const ref = useRef(null);

    useEffect(() => { setDraft(value); }, [value]);

    useEffect(() => {
        if (editing && ref.current) {
            ref.current.focus();
            ref.current.select?.();
        }
    }, [editing]);

    const commit = () => {
        const trimmed = draft.trim();
        if (trimmed && trimmed !== value) onSave(trimmed);
        else setDraft(value);
        setEditing(false);
    };

    const handleKey = (e) => {
        if (e.key === "Enter" && tag === "input") { e.preventDefault(); commit(); }
        if (e.key === "Escape") { setDraft(value); setEditing(false); }
    };

    if (!editing) {
        return (
            <span
                role="button"
                tabIndex={0}
                onClick={() => setEditing(true)}
                onKeyDown={(e) => e.key === "Enter" && setEditing(true)}
                className={`cursor-text hover:bg-gray-700/50 rounded px-1 -mx-1 transition-colors ${className}`}
                title="Clique para editar"
            >
                {value || <span className="text-gray-500 italic">{placeholder}</span>}
            </span>
        );
    }

    const sharedProps = {
        ref,
        value: draft,
        onChange: (e) => setDraft(e.target.value),
        onBlur: commit,
        onKeyDown: handleKey,
        placeholder,
        className: `bg-gray-700 border border-gray-500/50 rounded px-2 py-1 text-gray-100 outline-none w-full ${className}`,
    };

    return tag === "textarea"
        ? <textarea {...sharedProps} rows={2} />
        : <input {...sharedProps} />;
}

// ── New Card Composer ────────────────────────────────────────

function CardComposer({ onAdd, onCancel }) {
    const [title, setTitle] = useState("");
    const inputRef = useRef(null);

    useEffect(() => { inputRef.current?.focus(); }, []);

    const submit = () => {
        const trimmed = title.trim();
        if (trimmed) { onAdd(trimmed); setTitle(""); }
    };

    return (
        <div className="bg-gray-800 border border-gray-600 rounded-xl p-3 space-y-2 shadow-lg">
            <textarea
                ref={inputRef}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
                    if (e.key === "Escape") onCancel();
                }}
                placeholder="Título do cartão..."
                rows={2}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 outline-none focus:border-gray-500/50 resize-none"
            />
            <div className="flex items-center gap-2">
                <button
                    onClick={submit}
                    disabled={!title.trim()}
                    className="bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold px-4 py-1.5 rounded-lg transition-colors"
                >
                    Adicionar
                </button>
                <button onClick={onCancel} className="text-gray-400 hover:text-gray-200 transition-colors">
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}

// ── Card Menu (edit / color / delete) ────────────────────────

function CardMenu({ onEdit, onColorChange, onDelete, currentColor }) {
    const [open, setOpen] = useState(false);
    const menuRef = useRef(null);

    useEffect(() => {
        if (!open) return;
        const handler = (e) => { if (!menuRef.current?.contains(e.target)) setOpen(false); };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    return (
        <div ref={menuRef} className="relative">
            <button
                onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
                className="p-1 rounded hover:bg-gray-600 text-gray-500 hover:text-gray-300 transition-colors opacity-0 group-hover:opacity-100"
            >
                <MoreHorizontal className="w-4 h-4" />
            </button>

            {open && (
                <div className="absolute right-0 top-7 z-50 bg-gray-800 border border-gray-600 rounded-xl shadow-2xl py-2 w-48 animate-vault-in">
                    <button
                        onClick={() => { onEdit(); setOpen(false); }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
                    >
                        <Pencil className="w-3.5 h-3.5" /> Editar descrição
                    </button>

                    <div className="px-4 py-2">
                        <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1.5">Cor</p>
                        <div className="flex gap-1.5">
                            {CARD_COLORS.map((c, i) => (
                                <button
                                    key={i}
                                    onClick={() => { onColorChange(c); setOpen(false); }}
                                    className={`w-5 h-5 rounded-full border-2 transition-all ${
                                        c === currentColor ? "border-white scale-110" : "border-transparent hover:scale-110"
                                    }`}
                                    style={{ background: c || "rgb(var(--gray-700))" }}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="border-t border-gray-700 mt-1 pt-1">
                        <button
                            onClick={() => { onDelete(); setOpen(false); }}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-rose-400 hover:bg-rose-500/10 transition-colors"
                        >
                            <Trash2 className="w-3.5 h-3.5" /> Excluir cartão
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Kanban Card ──────────────────────────────────────────────

function KanbanCard({ card, index, actions }) {
    const [editingDesc, setEditingDesc] = useState(false);

    return (
        <Draggable draggableId={card.id} index={index}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    className={`bg-gray-800 border rounded-xl p-3 group transition-shadow ${
                        snapshot.isDragging
                            ? "shadow-2xl shadow-sky-500/15 border-sky-500/30 ring-1 ring-sky-500/20"
                            : "border-gray-700 hover:border-gray-600 shadow-sm"
                    }`}
                    style={{
                        ...provided.draggableProps.style,
                        borderLeftWidth: "3px",
                        borderLeftColor: card.color || "rgb(var(--gray-600))",
                    }}
                >
                    <div className="flex items-start gap-1.5">
                        <div {...provided.dragHandleProps} className="pt-0.5 flex-shrink-0 cursor-grab active:cursor-grabbing">
                            <GripVertical className="w-4 h-4 text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>

                        <div className="flex-1 min-w-0">
                            <InlineEdit
                                value={card.title}
                                onSave={(title) => actions.updateCard(card.id, { title })}
                                className="text-sm font-medium text-gray-200 leading-snug block"
                                placeholder="Sem título"
                            />

                            {editingDesc ? (
                                <div className="mt-2">
                                    <InlineEdit
                                        value={card.description || ""}
                                        onSave={(description) => {
                                            actions.updateCard(card.id, { description });
                                            setEditingDesc(false);
                                        }}
                                        tag="textarea"
                                        className="text-xs text-gray-400"
                                        placeholder="Adicionar descrição..."
                                    />
                                </div>
                            ) : card.description ? (
                                <p
                                    onClick={() => setEditingDesc(true)}
                                    className="mt-1.5 text-xs text-gray-500 leading-relaxed line-clamp-3 cursor-text hover:text-gray-400 transition-colors"
                                >
                                    {card.description}
                                </p>
                            ) : null}
                        </div>

                        <CardMenu
                            currentColor={card.color}
                            onEdit={() => setEditingDesc(true)}
                            onColorChange={(color) => actions.updateCard(card.id, { color })}
                            onDelete={() => actions.deleteCard(card.id)}
                        />
                    </div>
                </div>
            )}
        </Draggable>
    );
}

// ── Column Header ────────────────────────────────────────────

function ColumnHeader({ column, cardCount, actions }) {
    const [confirmDelete, setConfirmDelete] = useState(false);

    return (
        <div className="px-3 py-3 flex items-center justify-between gap-2 flex-shrink-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
                <InlineEdit
                    value={column.title}
                    onSave={(title) => actions.updateColumnTitle(column.id, title)}
                    className="text-sm font-bold text-gray-300"
                    placeholder="Nome da coluna"
                />
                <span className="bg-gray-700 text-[10px] font-bold text-gray-400 px-2 py-0.5 rounded-full min-w-[20px] text-center flex-shrink-0">
                    {cardCount}
                </span>
            </div>

            {confirmDelete ? (
                <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                        onClick={() => actions.deleteColumn(column.id)}
                        className="text-[10px] font-semibold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 px-2 py-1 rounded-lg transition-colors"
                    >
                        Confirmar
                    </button>
                    <button
                        onClick={() => setConfirmDelete(false)}
                        className="text-gray-500 hover:text-gray-300 transition-colors"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            ) : (
                <button
                    onClick={() => setConfirmDelete(true)}
                    className="p-1 text-gray-600 hover:text-rose-400 rounded hover:bg-gray-700/50 transition-colors flex-shrink-0"
                    title="Excluir coluna"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            )}
        </div>
    );
}

// ── Kanban Column ────────────────────────────────────────────

function KanbanColumn({ column, cards, index, actions }) {
    const [composerOpen, setComposerOpen] = useState(false);

    const handleAddCard = useCallback((title) => {
        actions.addCard(column.id, title);
        setComposerOpen(false);
    }, [actions, column.id]);

    return (
        <Draggable draggableId={column.id} index={index}>
            {(colProvided, colSnapshot) => (
                <div
                    ref={colProvided.innerRef}
                    {...colProvided.draggableProps}
                    className={`flex flex-col w-[320px] min-w-[320px] rounded-2xl bg-gray-900/60 border transition-all ${
                        colSnapshot.isDragging
                            ? "border-sky-500/30 shadow-2xl shadow-sky-500/10"
                            : "border-gray-800"
                    }`}
                >
                    <div {...colProvided.dragHandleProps}>
                        <ColumnHeader column={column} cardCount={cards.length} actions={actions} />
                    </div>

                    <Droppable droppableId={column.id} type="CARD">
                        {(provided, snapshot) => (
                            <div
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                className={`flex-1 overflow-y-auto custom-scrollbar px-2 pb-2 space-y-2 min-h-[60px] transition-colors rounded-b-2xl ${
                                    snapshot.isDraggingOver ? "bg-sky-500/5" : ""
                                }`}
                            >
                                {cards.map((card, i) => (
                                    <KanbanCard key={card.id} card={card} index={i} actions={actions} />
                                ))}
                                {provided.placeholder}

                                {cards.length === 0 && !snapshot.isDraggingOver && !composerOpen && (
                                    <div className="border-2 border-dashed border-gray-700/40 rounded-xl p-6 text-center">
                                        <p className="text-xs text-gray-600">Arraste cartões para cá</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </Droppable>

                    <div className="px-2 pb-2 flex-shrink-0">
                        {composerOpen ? (
                            <CardComposer onAdd={handleAddCard} onCancel={() => setComposerOpen(false)} />
                        ) : (
                            <button
                                onClick={() => setComposerOpen(true)}
                                className="w-full flex items-center gap-2 text-sm text-gray-500 hover:text-gray-300 hover:bg-gray-800 px-3 py-2 rounded-xl transition-colors"
                            >
                                <Plus className="w-4 h-4" /> Adicionar cartão
                            </button>
                        )}
                    </div>
                </div>
            )}
        </Draggable>
    );
}

// ── Main Kanban View ─────────────────────────────────────────

export function KanbanView({ board, actions }) {
    const handleDragEnd = useCallback((result) => {
        const { source, destination, type } = result;
        if (!destination) return;
        if (source.droppableId === destination.droppableId && source.index === destination.index) return;

        if (type === "COLUMN") {
            actions.reorderColumn(source.index, destination.index);
            return;
        }

        actions.reorderCard(
            source.droppableId,
            destination.droppableId,
            source.index,
            destination.index,
        );
    }, [actions]);

    const orderedColumns = board.columnOrder
        .map((id) => board.columns[id])
        .filter(Boolean);

    return (
        <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="board" type="COLUMN" direction="horizontal">
                {(provided) => (
                    <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className="flex gap-4 h-full min-h-0 overflow-x-auto pb-4 custom-scrollbar items-start"
                    >
                        {orderedColumns.map((col, index) => {
                            const cards = col.cardIds
                                .map((cid) => board.cards[cid])
                                .filter(Boolean);
                            return (
                                <KanbanColumn
                                    key={col.id}
                                    column={col}
                                    cards={cards}
                                    index={index}
                                    actions={actions}
                                />
                            );
                        })}
                        {provided.placeholder}

                        <button
                            onClick={() => actions.addColumn()}
                            className="flex items-center gap-2 min-w-[280px] px-4 py-3 text-sm font-medium text-gray-500 hover:text-gray-300 bg-gray-900/30 hover:bg-gray-800/60 border border-dashed border-gray-700 hover:border-gray-600 rounded-2xl transition-all flex-shrink-0 h-fit"
                        >
                            <Plus className="w-4 h-4" /> Adicionar coluna
                        </button>
                    </div>
                )}
            </Droppable>
        </DragDropContext>
    );
}
