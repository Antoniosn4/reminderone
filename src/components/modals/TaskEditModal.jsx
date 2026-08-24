// =============================================================
//  TaskEditModal.jsx
//  Modal completo de edição de tarefa com campos de data,
//  horário, prioridade e projeto.
// =============================================================

import { useState, useEffect, useRef } from "react";
import {
    Settings, X, Calendar, Clock, Hash,
    ChevronDown, Trash2,
} from "lucide-react";

const PRIORITIES = [
    { id: "low", label: "Baixa", colorClass: "hover:border-blue-500/50 hover:bg-blue-500/10", activeClass: "border-blue-500 bg-blue-500/20 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.2)]" },
    { id: "normal", label: "Média", colorClass: "hover:border-emerald-500/50 hover:bg-emerald-500/10", activeClass: "border-emerald-500 bg-emerald-500/20 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]" },
    { id: "high", label: "Alta", colorClass: "hover:border-orange-500/50 hover:bg-orange-500/10", activeClass: "border-orange-500 bg-orange-500/20 text-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.2)]" },
    { id: "urgent", label: "Urgente", colorClass: "hover:border-red-500/50 hover:bg-red-500/10", activeClass: "border-red-500 bg-red-500/20 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.2)]" },
];

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

    if (!task) return null;

    const handleChange = (field, value) =>
        setEditedTask((prev) => ({ ...prev, [field]: value }));

    const handleProjectChange = (e) => {
        if (e.target.value === "__CREATE_NEW__") {
            onCreateNewProject?.();
        } else {
            handleChange("project", e.target.value);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[80] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="bg-gray-800 border border-gray-700 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden shadow-black/50"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-700 bg-gray-800/80">
                    <h2 className="text-lg font-bold text-gray-100 flex items-center gap-2">
                        <Settings className="w-5 h-5 text-gray-400" /> Detalhes da Tarefa
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors p-1.5 rounded-lg hover:bg-gray-700">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
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

                    {/* Data + Horário */}
                    <div className="grid grid-cols-2 gap-5">
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

                    {/* Prioridade */}
                    <div>
                        <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                            Nível de Prioridade
                        </label>
                        <div className="grid grid-cols-4 gap-3">
                            {PRIORITIES.map((p) => {
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
                        <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                            Projeto / Lista
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
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-6 border-t border-gray-700 bg-gray-800/80">
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
                                date: editedTask.date,
                                time: editedTask.time,
                                priority: editedTask.priority,
                                project: editedTask.project,
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
