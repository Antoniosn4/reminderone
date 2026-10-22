// =============================================================
//  ProjectModals.jsx
//  Modais de criação e edição de projetos.
//  Edição cobre: nome, cor, sub-pastas (criar/renomear/excluir)
//  e exclusão do projeto inteiro.
// =============================================================

import { useEffect, useMemo, useState } from "react";
import { Hash, Settings, X, Trash2, Plus, Pencil, Check, FolderTree } from "lucide-react";

const COLORS = [
    "#3b82f6", "#8b5cf6", "#ec4899", "#f97316",
    "#10b981", "#eab308", "#ef4444", "#06b6d4",
];

const MAX_LABEL_LENGTH = 60;

function sanitize(value) {
    return value.replace(/[<>]/g, "").slice(0, MAX_LABEL_LENGTH);
}

function ColorPicker({ value, onChange }) {
    return (
        <div className="flex gap-3 flex-wrap">
            {COLORS.map((color) => (
                <button
                    key={color}
                    type="button"
                    onClick={() => onChange(color)}
                    aria-label={`Cor ${color}`}
                    aria-pressed={value === color}
                    className={`w-8 h-8 rounded-full border-2 transition-transform active:scale-90 ${
                        value === color
                            ? "border-white scale-110 shadow-lg"
                            : "border-transparent hover:scale-110"
                    }`}
                    style={{
                        backgroundColor: color,
                        boxShadow: value === color ? `0 0 12px ${color}60` : "none",
                    }}
                />
            ))}
        </div>
    );
}

// ── Criar Projeto ──

export function NewProjectModal({ isOpen, onClose, onAddProject }) {
    const [name, setName] = useState("");
    const [color, setColor] = useState(COLORS[0]);

    useEffect(() => {
        if (!isOpen) {
            setName("");
            setColor(COLORS[0]);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (event) => {
        event.preventDefault();
        const trimmed = sanitize(name).trim();
        if (!trimmed) return;
        onAddProject({ label: trimmed, color });
        setName("");
        setColor(COLORS[0]);
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[90] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="bg-gray-800 border border-gray-700 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden shadow-black/50"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex items-center justify-between p-6 border-b border-gray-700 bg-gray-800/80">
                    <h2 className="text-lg font-bold text-gray-100 flex items-center gap-2">
                        <Hash className="w-5 h-5 text-gray-400" /> Criar Projeto
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-300 transition-colors p-1.5 rounded-lg hover:bg-gray-700"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div>
                        <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                            Nome do Projeto
                        </label>
                        <input
                            autoFocus
                            type="text"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            maxLength={MAX_LABEL_LENGTH}
                            className="w-full bg-gray-900 border border-gray-700 text-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gray-500 transition-all shadow-inner"
                            placeholder="Ex: Faculdade"
                        />
                    </div>
                    <div>
                        <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                            Cor de Destaque
                        </label>
                        <ColorPicker value={color} onChange={setColor} />
                    </div>
                    <div className="flex items-center justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2.5 text-sm font-bold text-gray-300 hover:text-gray-100 hover:bg-gray-700 rounded-xl transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold rounded-xl transition-all shadow-md transform active:scale-95"
                        >
                            Criar Projeto
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ── Editar Projeto (inclui sub-pastas) ──

/**
 * @param {{
 *   project: object | null,
 *   onClose: () => void,
 *   onSave: (id: string, updates: object) => void,
 *   onDelete: (id: string) => void,
 *   onAddSubProject: (projectId: string, label: string) => void,
 *   onUpdateSubProject: (projectId: string, subId: string, updates: object) => void,
 *   onRemoveSubProject: (projectId: string, subId: string) => void,
 * }} props
 */
export function EditProjectModal({
    project,
    onClose,
    onSave,
    onDelete,
    onAddSubProject,
    onUpdateSubProject,
    onRemoveSubProject,
}) {
    const [name, setName] = useState("");
    const [color, setColor] = useState(COLORS[0]);
    const [newSubLabel, setNewSubLabel] = useState("");
    const [editingSubId, setEditingSubId] = useState(null);
    const [editingSubLabel, setEditingSubLabel] = useState("");
    const [confirmDelete, setConfirmDelete] = useState(false);

    useEffect(() => {
        if (project) {
            setName(project.label ?? "");
            setColor(project.color ?? COLORS[0]);
            setEditingSubId(null);
            setEditingSubLabel("");
            setNewSubLabel("");
            setConfirmDelete(false);
        }
    }, [project?.id]);

    const subProjects = useMemo(
        () => project?.subProjects ?? [],
        [project?.subProjects],
    );

    if (!project) return null;

    const trimmedName = sanitize(name).trim();
    const isNameDirty = trimmedName.length > 0 && trimmedName !== project.label;
    const isColorDirty = color !== project.color;
    const canSave = trimmedName.length > 0 && (isNameDirty || isColorDirty);

    const handleSave = (event) => {
        event.preventDefault();
        if (!canSave) return;
        onSave(project.id, { label: trimmedName, color });
    };

    const handleAddSub = (event) => {
        event.preventDefault();
        const cleaned = sanitize(newSubLabel).trim();
        if (!cleaned) return;
        onAddSubProject(project.id, cleaned);
        setNewSubLabel("");
    };

    const startEditingSub = (sub) => {
        setEditingSubId(sub.id);
        setEditingSubLabel(sub.label);
    };

    const commitSubEdit = () => {
        if (!editingSubId) return;
        const cleaned = sanitize(editingSubLabel).trim();
        if (cleaned) onUpdateSubProject(project.id, editingSubId, { label: cleaned });
        setEditingSubId(null);
        setEditingSubLabel("");
    };

    const cancelSubEdit = () => {
        setEditingSubId(null);
        setEditingSubLabel("");
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[90] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="bg-gray-800 border border-gray-700 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden shadow-black/50"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex items-center justify-between p-6 border-b border-gray-700 bg-gray-800/80">
                    <h2 className="text-lg font-bold text-gray-100 flex items-center gap-2">
                        <Settings className="w-5 h-5 text-gray-400" /> Editar Projeto
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-300 transition-colors p-1.5 rounded-lg hover:bg-gray-700"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    <form onSubmit={handleSave} className="space-y-6">
                        <div>
                            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                                Nome do Projeto
                            </label>
                            <input
                                autoFocus
                                type="text"
                                value={name}
                                onChange={(event) => setName(event.target.value)}
                                maxLength={MAX_LABEL_LENGTH}
                                className="w-full bg-gray-900 border border-gray-700 text-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gray-500 transition-all shadow-inner"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                                Cor de Destaque
                            </label>
                            <ColorPicker value={color} onChange={setColor} />
                        </div>
                    </form>

                    <div className="border-t border-gray-700 pt-5">
                        <div className="flex items-center gap-2 mb-3">
                            <FolderTree className="w-4 h-4 text-gray-400" />
                            <h3 className="text-[11px] font-bold text-gray-300 uppercase tracking-widest">
                                Sub-pastas
                                <span className="ml-2 text-gray-500 normal-case font-medium">
                                    {subProjects.length} item{subProjects.length === 1 ? "" : "s"}
                                </span>
                            </h3>
                        </div>

                        <ul className="space-y-1.5 mb-3">
                            {subProjects.length === 0 && (
                                <li className="text-xs text-gray-500 italic px-1">
                                    Sem sub-pastas. Crie a primeira abaixo.
                                </li>
                            )}
                            {subProjects.map((sub) => {
                                const isEditing = editingSubId === sub.id;
                                return (
                                    <li
                                        key={sub.id}
                                        className="flex items-center gap-2 bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5"
                                    >
                                        {isEditing ? (
                                            <>
                                                <input
                                                    autoFocus
                                                    value={editingSubLabel}
                                                    onChange={(event) => setEditingSubLabel(event.target.value)}
                                                    onKeyDown={(event) => {
                                                        if (event.key === "Enter") commitSubEdit();
                                                        if (event.key === "Escape") cancelSubEdit();
                                                    }}
                                                    maxLength={MAX_LABEL_LENGTH}
                                                    className="flex-1 bg-gray-800 border border-gray-700 text-gray-100 rounded-md px-2 py-1 text-sm focus:outline-none focus:border-gray-500"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={commitSubEdit}
                                                    title="Salvar"
                                                    className="p-1.5 rounded-md text-emerald-400 hover:bg-emerald-500/10"
                                                >
                                                    <Check className="w-4 h-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={cancelSubEdit}
                                                    title="Cancelar"
                                                    className="p-1.5 rounded-md text-gray-400 hover:bg-gray-700"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <span className="flex-1 text-sm text-gray-200 truncate">
                                                    {sub.label}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => startEditingSub(sub)}
                                                    title="Renomear"
                                                    className="p-1.5 rounded-md text-gray-400 hover:text-gray-200 hover:bg-gray-700"
                                                >
                                                    <Pencil className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => onRemoveSubProject(project.id, sub.id)}
                                                    title="Excluir sub-pasta"
                                                    className="p-1.5 rounded-md text-gray-400 hover:text-rose-400 hover:bg-rose-500/10"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>

                        <form onSubmit={handleAddSub} className="flex items-center gap-2">
                            <input
                                value={newSubLabel}
                                onChange={(event) => setNewSubLabel(event.target.value)}
                                maxLength={MAX_LABEL_LENGTH}
                                className="flex-1 bg-gray-900 border border-gray-700 text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
                                placeholder="Nome da sub-pasta"
                            />
                            <button
                                type="submit"
                                disabled={!newSubLabel.trim()}
                                className="flex items-center gap-1.5 px-3 py-2 bg-gray-700/50 border border-gray-600 text-gray-300 hover:bg-gray-600/60 rounded-lg text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <Plus className="w-4 h-4" /> Adicionar
                            </button>
                        </form>
                    </div>
                </div>

                <div className="flex items-center justify-between p-6 border-t border-gray-700 bg-gray-800/80">
                    {confirmDelete ? (
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-rose-300">Excluir definitivamente?</span>
                            <button
                                type="button"
                                onClick={() => onDelete(project.id)}
                                className="px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold rounded-lg"
                            >
                                Sim, excluir
                            </button>
                            <button
                                type="button"
                                onClick={() => setConfirmDelete(false)}
                                className="px-3 py-1.5 text-xs font-bold text-gray-400 hover:text-gray-100"
                            >
                                Cancelar
                            </button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setConfirmDelete(true)}
                            className="flex items-center gap-2 text-sm font-bold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 px-4 py-2.5 rounded-xl transition-all"
                        >
                            <Trash2 className="w-4 h-4" /> Excluir
                        </button>
                    )}
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2.5 text-sm font-bold text-gray-300 hover:text-gray-100 hover:bg-gray-700 rounded-xl transition-all"
                        >
                            Fechar
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={!canSave}
                            className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all transform active:scale-95 ${
                                canSave
                                    ? "bg-indigo-500 hover:bg-indigo-600 text-white shadow-md"
                                    : "bg-gray-800 text-gray-500 cursor-not-allowed"
                            }`}
                        >
                            Salvar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
