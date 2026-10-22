// =============================================================
//  TaskEditModal.jsx
//  Modal completo de edição de tarefa com TODOS os campos do
//  schema: título, descrição, data, horário, prioridade,
//  projeto, subprojeto, tags, duração estimada e lembrete.
//
//  Compatível com o schema canônico de taskSchema.js para
//  garantir paridade entre desktop e mobile.
// =============================================================

import { useState, useEffect, useRef, useCallback } from "react";
import {
    Settings, X, Calendar, Clock, Hash, Tag,
    ChevronDown, Trash2, AlignLeft, Timer, Bell,
    FolderOpen, Plus,
} from "lucide-react";
import { PRIORITY_META } from "../../constants/taskSchema";

/**
 * @param {{
 *   task: object | null,
 *   onClose: () => void,
 *   onSave: (id: number, updates: object) => void,
 *   onDelete: (id: number) => void,
 *   projects: Array,
 *   onCreateNewProject: () => void,
 * }} props
 */
export function TaskEditModal({ task, onClose, onSave, onDelete, projects = [], onCreateNewProject }) {
    const [editedTask, setEditedTask] = useState({});
    const [tagInput, setTagInput] = useState("");
    const prevProjectsLength = useRef(projects.length);

    useEffect(() => {
        if (task) setEditedTask({ ...task });
    }, [task]);

    // Auto-select newly created project
    useEffect(() => {
        if (projects.length > prevProjectsLength.current) {
            setEditedTask((prev) => ({
                ...prev,
                project: projects[projects.length - 1].label,
            }));
        }
        prevProjectsLength.current = projects.length;
    }, [projects]);

    const handleChange = (field, value) =>
        setEditedTask((prev) => ({ ...prev, [field]: value }));

    const handleProjectChange = (e) => {
        if (e.target.value === "__CREATE_NEW__") {
            onCreateNewProject?.();
        } else {
            handleChange("project", e.target.value);
        }
    };

    // ── Tags management ──
    const handleAddTag = useCallback(() => {
        const trimmed = tagInput.trim().toLowerCase();
        if (!trimmed) return;
        setEditedTask((prev) => {
            const currentTags = Array.isArray(prev.tags) ? prev.tags : [];
            if (currentTags.includes(trimmed)) return prev;
            return { ...prev, tags: [...currentTags, trimmed] };
        });
        setTagInput("");
    }, [tagInput]);

    const handleRemoveTag = useCallback((tagToRemove) => {
        setEditedTask((prev) => ({
            ...prev,
            tags: (prev.tags || []).filter((t) => t !== tagToRemove),
        }));
    }, []);

    const handleTagKeyDown = useCallback((e) => {
        if (e.key === "Enter") { e.preventDefault(); handleAddTag(); }
    }, [handleAddTag]);

    // ── Subprojects for selected project ──
    const selectedProject = projects.find((p) => p.label === editedTask.project);
    const subProjects = selectedProject?.subProjects || [];

    // Depois de todos os hooks: retornar antes deles muda a contagem entre renders.
    if (!task) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-[80] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="bg-gray-800 border border-gray-700 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden shadow-black/50 flex flex-col max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-700 bg-gray-800/80 flex-shrink-0">
                    <h2 className="text-lg font-bold text-gray-100 flex items-center gap-2">
                        <Settings className="w-5 h-5 text-gray-400" /> Detalhes da Tarefa
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors p-1.5 rounded-lg hover:bg-gray-700">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body — scrollable */}
                <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
                    {/* Título */}
                    <div>
                        <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                            O que precisa ser feito?
                        </label>
                        <input
                            type="text"
                            value={editedTask.title || ""}
                            onChange={(e) => handleChange("title", e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 text-gray-100 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500/40 transition-all shadow-inner"
                            placeholder="Ex: Preparar relatório mensal..."
                        />
                    </div>

                    {/* Descrição */}
                    <div>
                        <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                            <AlignLeft className="w-3.5 h-3.5" /> Descrição
                        </label>
                        <textarea
                            value={editedTask.description || ""}
                            onChange={(e) => handleChange("description", e.target.value)}
                            rows={3}
                            className="w-full bg-gray-900 border border-gray-700 text-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500/40 transition-all shadow-inner resize-none"
                            placeholder="Detalhes adicionais, contexto, links..."
                        />
                    </div>

                    {/* Data + Horário */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Data</label>
                            <div className="relative group">
                                <Calendar className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2 group-focus-within:text-gray-300 transition-colors" />
                                <input
                                    type="date"
                                    value={editedTask.date || ""}
                                    onChange={(e) => handleChange("date", e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-700 text-gray-100 rounded-xl pl-10 pr-3 py-3 text-sm focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500/40 transition-all shadow-inner [color-scheme:dark]"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Horário</label>
                            <div className="relative group">
                                <Clock className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2 group-focus-within:text-gray-300 transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Ex: 14:30 ou Sem hora"
                                    value={editedTask.time || ""}
                                    onChange={(e) => handleChange("time", e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-700 text-gray-100 rounded-xl pl-10 pr-3 py-3 text-sm focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500/40 transition-all shadow-inner"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Duração Estimada + Lembrete */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                <Timer className="w-3.5 h-3.5" /> Duração (min)
                            </label>
                            <input
                                type="number"
                                min="0"
                                placeholder="Ex: 30"
                                value={editedTask.estimatedDuration ?? ""}
                                onChange={(e) => handleChange("estimatedDuration", e.target.value ? Number(e.target.value) : null)}
                                className="w-full bg-gray-900 border border-gray-700 text-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500/40 transition-all shadow-inner [color-scheme:dark]"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                <Bell className="w-3.5 h-3.5" /> Lembrete
                            </label>
                            <input
                                type="datetime-local"
                                value={editedTask.reminder ? editedTask.reminder.slice(0, 16) : ""}
                                onChange={(e) => handleChange("reminder", e.target.value ? new Date(e.target.value).toISOString() : null)}
                                className="w-full bg-gray-900 border border-gray-700 text-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500/40 transition-all shadow-inner [color-scheme:dark]"
                            />
                        </div>
                    </div>

                    {/* Prioridade */}
                    <div>
                        <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                            Nível de Prioridade
                        </label>
                        <div className="grid grid-cols-4 gap-3">
                            {PRIORITY_META.map((p) => {
                                const isActive = (editedTask.priority || "normal") === p.id;
                                return (
                                    <button
                                        key={p.id}
                                        type="button"
                                        onClick={() => handleChange("priority", p.id)}
                                        className={`py-2.5 text-xs font-bold rounded-xl border transition-all duration-200 ease-out transform active:scale-95 ${
                                            isActive
                                                ? p.activeClass
                                                : `border-gray-700 bg-gray-900 text-gray-400 ${p.colorClass}`
                                        }`}
                                    >
                                        {p.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Projeto */}
                    <div>
                        <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                            <FolderOpen className="w-3.5 h-3.5" /> Projeto / Lista
                        </label>
                        <div className="relative group">
                            <Hash className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2 group-focus-within:text-gray-300 transition-colors" />
                            <select
                                value={editedTask.project || "Entrada"}
                                onChange={handleProjectChange}
                                className="w-full bg-gray-900 border border-gray-700 text-gray-100 rounded-xl pl-10 pr-10 py-3 text-sm focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500/40 transition-all appearance-none shadow-inner cursor-pointer"
                            >
                                <option value="Entrada">Caixa de Entrada</option>
                                {projects.map((p) => (
                                    <option key={p.id} value={p.label}>{p.label}</option>
                                ))}
                                <option value="Ideias de Produto">Ideias de Produto</option>
                                <option disabled>──────────</option>
                                <option value="__CREATE_NEW__">+ Criar Novo Projeto...</option>
                            </select>
                            <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                                <ChevronDown className="w-4 h-4 text-gray-500" />
                            </div>
                        </div>
                    </div>

                    {/* Subprojeto (se projeto tiver subprojetos) */}
                    {subProjects.length > 0 && (
                        <div>
                            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                                Subprojeto
                            </label>
                            <div className="relative group">
                                <select
                                    value={editedTask.subProject || ""}
                                    onChange={(e) => handleChange("subProject", e.target.value || null)}
                                    className="w-full bg-gray-900 border border-gray-700 text-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500/40 transition-all appearance-none shadow-inner cursor-pointer"
                                >
                                    <option value="">Nenhum</option>
                                    {subProjects.map((sp) => (
                                        <option key={sp.id} value={sp.label}>{sp.label}</option>
                                    ))}
                                </select>
                                <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                                    <ChevronDown className="w-4 h-4 text-gray-500" />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tags */}
                    <div>
                        <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                            <Tag className="w-3.5 h-3.5" /> Tags
                        </label>
                        <div className="flex flex-wrap gap-2 mb-2">
                            {(editedTask.tags || []).map((tag) => (
                                <span
                                    key={tag}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/15 border border-indigo-500/25 text-indigo-300 text-xs font-medium"
                                >
                                    #{tag}
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveTag(tag)}
                                        className="text-indigo-400 hover:text-red-400 transition-colors"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </span>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={tagInput}
                                onChange={(e) => setTagInput(e.target.value)}
                                onKeyDown={handleTagKeyDown}
                                placeholder="Adicionar tag..."
                                className="flex-1 bg-gray-900 border border-gray-700 text-gray-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500/40 transition-all shadow-inner"
                            />
                            <button
                                type="button"
                                onClick={handleAddTag}
                                className="px-3 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-xl transition-all text-sm"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Metadata de timestamps (somente leitura) */}
                    {(editedTask.createdAt || editedTask.updatedAt) && (
                        <div className="pt-2 border-t border-gray-700/50 flex flex-wrap gap-4 text-[10px] text-gray-500 font-mono">
                            {editedTask.createdAt && (
                                <span>Criada: {new Date(editedTask.createdAt).toLocaleString("pt-BR")}</span>
                            )}
                            {editedTask.updatedAt && (
                                <span>Atualizada: {new Date(editedTask.updatedAt).toLocaleString("pt-BR")}</span>
                            )}
                            {editedTask.completedAt && (
                                <span>Concluída: {new Date(editedTask.completedAt).toLocaleString("pt-BR")}</span>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-6 border-t border-gray-700 bg-gray-800/80 flex-shrink-0">
                    <button
                        onClick={() => onDelete(task.id)}
                        className="flex items-center gap-2 text-sm font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 px-4 py-2.5 rounded-xl transition-all border border-transparent hover:border-red-500/20"
                    >
                        <Trash2 className="w-4 h-4" /> Excluir
                    </button>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-6 py-2.5 text-sm font-bold text-gray-300 hover:text-gray-100 hover:bg-gray-700 rounded-xl transition-all">
                            Cancelar
                        </button>
                        <button
                            onClick={() => onSave(task.id, {
                                title: editedTask.title,
                                description: editedTask.description,
                                date: editedTask.date,
                                time: editedTask.time,
                                priority: editedTask.priority,
                                project: editedTask.project,
                                subProject: editedTask.subProject,
                                tags: editedTask.tags,
                                estimatedDuration: editedTask.estimatedDuration,
                                reminder: editedTask.reminder,
                            })}
                            className="px-6 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold rounded-xl transition-all shadow-md transform active:scale-95"
                        >
                            Salvar Alterações
                        </button>
                    </div>
                </div>
            </div>
            <div className="absolute inset-0 -z-10" onClick={onClose} />
        </div>
    );
}
