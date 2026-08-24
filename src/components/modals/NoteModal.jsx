// =============================================================
//  NoteModal.jsx
//  Modal de criação / edição de anotações com BlockNote editor.
//
//  Fluxo:
//    - Edição: qualquer alteração dispara debounced save (800ms).
//    - Criação: salva ao clicar "Criar" ou Ctrl+Enter.
//    - Indicador "Salvo" / "Salvando..." no footer.
//    - ESC fecha (flush de alterações pendentes).
//
//  Modelo de dados:
//    - blocks: Array<Block> (JSON nativo do BlockNote — lossless)
//    - content: string (mantido para retrocompatibilidade)
// =============================================================

import { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react";
import { StickyNote, X, Check, Loader2 } from "lucide-react";

const NoteEditor = lazy(() =>
    import("../NoteEditor").then((m) => ({ default: m.NoteEditor })),
);

const COLOR_OPTIONS = [
    { id: "gray",    hex: "#4b5563" },
    { id: "blue",    hex: "#3b82f6" },
    { id: "emerald", hex: "#10b981" },
    { id: "rose",    hex: "#f43f5e" },
    { id: "amber",   hex: "#f59e0b" },
    { id: "violet",  hex: "#8b5cf6" },
];

const DEBOUNCE_MS = 800;
const SAVED_FEEDBACK_MS = 2000;

function blocksToPlainText(blocks) {
    if (!Array.isArray(blocks)) return "";
    return blocks
        .map((b) => {
            if (!b?.content) return "";
            if (typeof b.content === "string") return b.content;
            if (Array.isArray(b.content)) {
                return b.content
                    .map((seg) => (typeof seg === "string" ? seg : seg?.text ?? ""))
                    .join("");
            }
            return "";
        })
        .filter(Boolean)
        .join("\n");
}

export function NoteModal({ isOpen, note, onClose, onSave }) {
    const [title, setTitle] = useState("");
    const [blocks, setBlocks] = useState(null);
    const [color, setColor] = useState("gray");
    const [saveStatus, setSaveStatus] = useState("idle");
    const titleRef = useRef(null);
    const debounceRef = useRef(null);
    const savedTimerRef = useRef(null);
    const isEditing = Boolean(note);
    const noteIdRef = useRef(null);
    const blocksRef = useRef(null);
    const editorKey = useRef(0);

    useEffect(() => {
        if (isOpen) {
            setTitle(note?.title ?? "");
            const initial = note?.blocks ?? null;
            setBlocks(initial);
            blocksRef.current = initial;
            setColor(note?.color ?? "gray");
            setSaveStatus("idle");
            noteIdRef.current = note?.id ?? null;
            editorKey.current += 1;
            requestAnimationFrame(() => titleRef.current?.focus());
        } else {
            clearTimeout(debounceRef.current);
            clearTimeout(savedTimerRef.current);
        }
    }, [isOpen, note]);

    const doSave = useCallback((t, blk, col) => {
        const trimTitle = t.trim();
        const plainText = blocksToPlainText(blk);
        if (!trimTitle && !plainText) return;

        onSave(noteIdRef.current, {
            title: trimTitle || "Sem título",
            blocks: blk,
            content: plainText,
            color: col,
        });

        setSaveStatus("saved");
        clearTimeout(savedTimerRef.current);
        savedTimerRef.current = setTimeout(() => setSaveStatus("idle"), SAVED_FEEDBACK_MS);
    }, [onSave]);

    const scheduleSave = useCallback((nextTitle, nextBlocks, nextColor) => {
        if (!isEditing) return;
        setSaveStatus("saving");
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            doSave(nextTitle, nextBlocks, nextColor);
        }, DEBOUNCE_MS);
    }, [isEditing, doSave]);

    const handleTitleChange = useCallback((e) => {
        const v = e.target.value;
        setTitle(v);
        scheduleSave(v, blocksRef.current, color);
    }, [color, scheduleSave]);

    const handleBlocksChange = useCallback((newBlocks) => {
        blocksRef.current = newBlocks;
        setBlocks(newBlocks);
        scheduleSave(title, newBlocks, color);
    }, [title, color, scheduleSave]);

    const handleColorChange = useCallback((c) => {
        setColor(c);
        scheduleSave(title, blocksRef.current, c);
    }, [title, scheduleSave]);

    const handleClose = useCallback(() => {
        clearTimeout(debounceRef.current);
        clearTimeout(savedTimerRef.current);
        if (isEditing) {
            doSave(title, blocksRef.current, color);
        }
        onClose();
    }, [isEditing, title, color, doSave, onClose]);

    const handleCreate = useCallback(() => {
        const plainText = blocksToPlainText(blocksRef.current);
        if (!title.trim() && !plainText) return;
        onSave(null, {
            title: title.trim() || "Sem título",
            blocks: blocksRef.current,
            content: plainText,
            color,
        });
        onClose();
    }, [title, color, onSave, onClose]);

    useEffect(() => {
        if (!isOpen) return undefined;
        const handler = (e) => {
            if (e.key === "Escape") handleClose();
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [isOpen, handleClose]);

    const handleTitleKeyDown = useCallback((e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            e.preventDefault();
            if (isEditing) handleClose();
            else handleCreate();
        }
    }, [isEditing, handleClose, handleCreate]);

    if (!isOpen) return null;

    const statusIndicator = isEditing && saveStatus === "saving"
        ? <><Loader2 className="w-3 h-3 animate-spin" /> Salvando...</>
        : isEditing && saveStatus === "saved"
            ? <><Check className="w-3 h-3" /> Salvo</>
            : "Ctrl+Enter para salvar";

    return (
        <div
            className="fixed inset-0 bg-black/60 z-[80] flex items-center justify-center p-4 backdrop-blur-sm"
            onClick={handleClose}
        >
            <div
                className="bg-gray-800 border border-gray-700 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden shadow-black/50 flex flex-col"
                style={{ height: "min(85vh, 780px)" }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-gray-700 bg-gray-800/80 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <StickyNote className="w-5 h-5 text-amber-400" />
                        <h2 className="text-lg font-bold text-gray-100">
                            {isEditing ? "Editar Anotação" : "Nova Anotação"}
                        </h2>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex gap-2 bg-gray-900 px-3 py-1.5 rounded-full border border-gray-700">
                            {COLOR_OPTIONS.map((c) => (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => handleColorChange(c.id)}
                                    aria-label={`Cor ${c.id}`}
                                    aria-pressed={color === c.id}
                                    className={`w-5 h-5 rounded-full transition-transform border-2 ${
                                        color === c.id
                                            ? "scale-125 border-white shadow-lg"
                                            : "border-transparent hover:scale-110"
                                    }`}
                                    style={{ backgroundColor: c.hex }}
                                />
                            ))}
                        </div>
                        <button
                            type="button"
                            onClick={handleClose}
                            className="text-gray-500 hover:text-gray-300 transition-colors p-1.5 rounded-lg hover:bg-gray-700"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Title + BlockNote Editor */}
                <div className="flex-1 flex flex-col overflow-hidden bg-gray-900/50">
                    <div className="px-6 pt-5">
                        <input
                            ref={titleRef}
                            type="text"
                            value={title}
                            onChange={handleTitleChange}
                            onKeyDown={handleTitleKeyDown}
                            maxLength={200}
                            className="w-full bg-transparent border-none text-2xl font-bold text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-0"
                            placeholder="Título da anotação..."
                        />
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar px-2 pt-2 pb-4 note-editor-wrapper">
                        <Suspense fallback={
                            <div className="flex items-center justify-center py-12 text-gray-500 gap-2">
                                <Loader2 className="w-5 h-5 animate-spin" /> Carregando editor...
                            </div>
                        }>
                            <NoteEditor
                                key={editorKey.current}
                                initialBlocks={blocks}
                                onChange={handleBlocksChange}
                            />
                        </Suspense>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-700 bg-gray-800/80 flex items-center justify-between flex-shrink-0">
                    <span className="text-xs text-gray-500 flex items-center gap-1.5">
                        {statusIndicator}
                    </span>
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={handleClose}
                            className="px-6 py-2.5 text-sm font-bold text-gray-300 hover:text-gray-100 hover:bg-gray-700 rounded-xl transition-all"
                        >
                            {isEditing ? "Fechar" : "Cancelar"}
                        </button>
                        {!isEditing && (
                            <button
                                type="button"
                                onClick={handleCreate}
                                className="px-6 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold rounded-xl transition-all shadow-md transform active:scale-95"
                            >
                                Criar Anotação
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
