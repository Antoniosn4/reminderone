// =============================================================
//  TaskItem.jsx
//  Componente de uma tarefa individual.
//  Features: toggle, subtarefas por IA, edição inline, exclusão.
// =============================================================

import { useState, useCallback, useRef } from "react";
import {
    CheckCircle2,
    Circle,
    Sparkles,
    Loader2,
    Hash,
    Trash2,
    Pencil,
    Check,
    X,
    RefreshCw,
    CalendarCheck,
    ArrowDown,
    Minus,
    ArrowUp,
    AlertCircle,
} from "lucide-react";
import { SubtaskList } from "./SubtaskList";
import { Avatar } from "../Avatar";

const ASSIGNEE_AVATAR_SIZE_PX = 14;

const PRIORITY_ICONS = {
    low:    { icon: ArrowDown,    color: "text-blue-400",    bg: "bg-blue-500/10", border: "border-blue-500/20" },
    normal: { icon: Minus,        color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
    high:   { icon: ArrowUp,      color: "text-orange-400",  bg: "bg-orange-500/10", border: "border-orange-500/20" },
    urgent: { icon: AlertCircle,   color: "text-red-400",     bg: "bg-red-500/10", border: "border-red-500/20" },
};

/**
 * @param {{
 *   task: object,
 *   onToggleTask: (id: number) => void,
 *   onUpdateTask: (id: number, updates: object) => void,
 *   onDeleteTask: (id: number) => void,
 *   onGenerateSubtasks: (id: number, title: string) => Promise<any>,
 *   onToggleSubtask: (taskId: number, index: number) => void
 * }} props
 */
export function TaskItem({
    task,
    onToggleTask,
    onUpdateTask,
    onDeleteTask,
    onGenerateSubtasks,
    onToggleSubtask,
    onEditTask,
}) {
    const [isGeneratingSubtasks, setIsGeneratingSubtasks] = useState(false);
    const [showSubtasks, setShowSubtasks] = useState(false);

    // ----- Estado de edição inline -----
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(task.title);
    const [editProject, setEditProject] = useState(task.project);
    const [editTime, setEditTime] = useState(task.time);
    const titleInputRef = useRef(null);

    const hasSubtasks = task.subtasks?.length > 0;
    const isSyncing = task.syncStatus === "pending";

    // ----- Handlers de subtarefas -----

    const handleSubtaskToggle = useCallback(
        (index) => onToggleSubtask(task.id, index),
        [task.id, onToggleSubtask]
    );

    const handleGenerateSubtasks = useCallback(
        async (e) => {
            e.stopPropagation();
            if (hasSubtasks) {
                setShowSubtasks((prev) => !prev);
                return;
            }
            setIsGeneratingSubtasks(true);
            setShowSubtasks(true);
            const result = await onGenerateSubtasks(task.id, task.title);
            if (!result) setShowSubtasks(false);
            setIsGeneratingSubtasks(false);
        },
        [hasSubtasks, task.id, task.title, onGenerateSubtasks]
    );

    // ----- Handlers de edição inline -----

    const handleEditStart = useCallback(
        (e) => {
            e.stopPropagation();
            if (task.completed) return; // Não edita tarefas concluídas
            setEditTitle(task.title);
            setEditProject(task.project);
            setEditTime(task.time);
            setIsEditing(true);
            // Foca no campo de título após o render
            setTimeout(() => titleInputRef.current?.focus(), 0);
        },
        [task.completed, task.title, task.project, task.time]
    );

    const handleEditSave = useCallback(() => {
        const trimmedTitle = editTitle.trim();
        if (trimmedTitle) {
            onUpdateTask(task.id, {
                title: trimmedTitle,
                project: editProject.trim() || task.project,
                time: editTime.trim() || task.time,
            });
        }
        setIsEditing(false);
    }, [editTitle, editProject, editTime, task.id, task.project, task.time, onUpdateTask]);

    const handleEditCancel = useCallback(() => {
        setIsEditing(false);
    }, []);

    const handleEditKeyDown = useCallback(
        (e) => {
            if (e.key === "Enter") { e.preventDefault(); handleEditSave(); }
            if (e.key === "Escape") handleEditCancel();
        },
        [handleEditSave, handleEditCancel]
    );

    const completedSubtasksCount = task.subtasks?.filter((s) => s.completed).length ?? 0;

    return (
        <div className="flex flex-col gap-2">
            {/* Card principal da tarefa */}
            <div
                className={`group flex items-center justify-between p-4 rounded-xl border transition-all duration-300 ease-out
                    ${task.completed
                        ? "bg-gray-900/50 border-gray-800/50 scale-[0.98] opacity-70"
                        : isEditing
                            ? "bg-gray-800 border-gray-600 shadow-lg shadow-black/10"
                            : "bg-gray-800 border-gray-700 hover:border-gray-500 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20"
                    }`}
            >
                {/* Conteúdo esquerdo: checkbox + título + metadados */}
                <div className="flex items-center gap-4 flex-1 min-w-0">
                    <button
                        onClick={() => onToggleTask(task.id)}
                        className={`relative flex-shrink-0 flex items-center justify-center transition-all duration-300 active:scale-90
                            ${task.completed
                                ? "text-emerald-500 scale-110"
                                : "text-gray-500 hover:text-indigo-400 hover:scale-110"
                            }`}
                    >
                        {task.completed ? (
                            <CheckCircle2 className="w-6 h-6" />
                        ) : (
                            <Circle className="w-6 h-6" />
                        )}
                    </button>

                    {/* ── Modo de visualização ── */}
                    {!isEditing ? (
                        <div
                            className="flex flex-col flex-1 cursor-pointer overflow-hidden"
                            onClick={() => onEditTask ? onEditTask(task) : onToggleTask(task.id)}
                            title="Clique para editar"
                        >
                            <div className="relative w-fit max-w-full">
                                <span
                                    className={`text-base font-medium block truncate transition-colors duration-300
                                        ${task.completed ? "text-gray-500" : "text-gray-200"}`}
                                >
                                    {task.title}
                                </span>
                                <span
                                    className={`absolute left-0 top-1/2 -mt-px h-[1.5px] w-full bg-gray-500
                                        transition-transform duration-300 ease-out origin-left
                                        ${task.completed ? "scale-x-100" : "scale-x-0"}`}
                                />
                            </div>

                            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                <span className="flex items-center gap-1 text-xs text-gray-400">
                                    <Hash className="w-3 h-3" style={{ color: task.projectColor }} />
                                    {task.project}
                                </span>
                                <span
                                    className={`text-[11px] font-medium px-2 py-0.5 rounded-md bg-gray-900 border transition-colors duration-300
                                        ${task.completed ? "border-gray-800 text-gray-600" : "border-gray-700 text-gray-400"}`}
                                >
                                    {task.time}
                                </span>
                                {task.date && task.date !== new Date().toISOString().split("T")[0] && (
                                    <span
                                        className={`text-[11px] font-medium px-2 py-0.5 rounded-md bg-gray-900 border transition-colors duration-300
                                            ${task.completed ? "border-gray-800 text-gray-600" : "border-sky-500/20 text-sky-400"}`}
                                    >
                                        📅 {new Date(task.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}
                                    </span>
                                )}
                                {task.assignee && (
                                    <div
                                        className="flex items-center gap-1 bg-gray-900/80 border border-gray-700 px-1.5 py-0.5 rounded-md"
                                        title={`Atribuído a ${task.assignee.name}`}
                                    >
                                        <Avatar name={task.assignee.name} size={ASSIGNEE_AVATAR_SIZE_PX} />
                                        <span className="text-[9px] text-gray-400 font-medium">
                                            {task.assignee.name}
                                        </span>
                                    </div>
                                )}
                                {hasSubtasks && (
                                    <span
                                        className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md border transition-colors duration-300
                                            ${task.completed
                                                ? "text-gray-500 bg-gray-800 border-gray-700"
                                                : "text-sky-400 bg-sky-500/10 border-sky-500/20"}`}
                                    >
                                        <Sparkles className="w-3 h-3" />
                                        {completedSubtasksCount}/{task.subtasks.length}
                                    </span>
                                )}
                                {(() => {
                                    const p = PRIORITY_ICONS[task.priority || "normal"];
                                    if (!p || task.priority === "normal") return null;
                                    const Icon = p.icon;
                                    return (
                                        <span className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md border ${p.bg} ${p.border} ${p.color}`}>
                                            <Icon className="w-3 h-3" />
                                            {task.priority === "urgent" ? "Urgente" : task.priority === "high" ? "Alta" : "Baixa"}
                                        </span>
                                    );
                                })()}
                            </div>
                        </div>
                    ) : (
                        /* ── Modo de edição inline ── */
                        <div className="flex flex-col flex-1 gap-2 min-w-0">
                            <input
                                ref={titleInputRef}
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                onKeyDown={handleEditKeyDown}
                                placeholder="Título da tarefa"
                                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-gray-400"
                            />
                            <div className="flex gap-2">
                                <input
                                    value={editProject}
                                    onChange={(e) => setEditProject(e.target.value)}
                                    onKeyDown={handleEditKeyDown}
                                    placeholder="Projeto"
                                    className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-1 text-xs text-gray-300 placeholder-gray-500 focus:outline-none focus:border-gray-500/50"
                                />
                                <input
                                    value={editTime}
                                    onChange={(e) => setEditTime(e.target.value)}
                                    onKeyDown={handleEditKeyDown}
                                    placeholder="Horário"
                                    className="w-24 bg-gray-900 border border-gray-700 rounded-lg px-3 py-1 text-xs text-gray-300 placeholder-gray-500 focus:outline-none focus:border-gray-500/50"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Ações direita */}
                <div className="flex items-center gap-3 ml-3 flex-shrink-0">
                    {isEditing ? (
                        /* Botões salvar/cancelar edição */
                        <div className="flex items-center gap-1">
                            <button
                                onClick={handleEditSave}
                                title="Salvar (Enter)"
                                className="p-1.5 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                            >
                                <Check className="w-4 h-4" />
                            </button>
                            <button
                                onClick={handleEditCancel}
                                title="Cancelar (Esc)"
                                className="p-1.5 text-gray-500 hover:bg-gray-700 rounded-lg transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        /* Botões normais (visíveis on hover) */
                        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                            {!task.completed && (
                                <button
                                    onClick={handleGenerateSubtasks}
                                    title="✨ Quebrar em passos com IA"
                                    className="flex items-center gap-1 text-xs font-medium text-sky-400 hover:bg-sky-500/10 px-2 py-1.5 rounded-lg transition-colors"
                                >
                                    {isGeneratingSubtasks ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <Sparkles className="w-3.5 h-3.5" />
                                    )}
                                </button>
                            )}
                            {!task.completed && (
                                <button
                                    onClick={handleEditStart}
                                    title="Editar tarefa"
                                    className="p-1.5 text-gray-500 hover:text-gray-300 hover:bg-gray-700 rounded-lg transition-colors"
                                >
                                    <Pencil className="w-3.5 h-3.5" />
                                </button>
                            )}
                            <button
                                onClick={(e) => { e.stopPropagation(); onDeleteTask(task.id); }}
                                title="Excluir tarefa"
                                className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}

                    <div title={isSyncing ? "Sincronizando..." : "Sincronizado"}>
                        {isSyncing ? (
                            <RefreshCw className={`w-4 h-4 animate-spin ${task.completed ? "text-gray-600" : "text-gray-500"}`} />
                        ) : (
                            <CalendarCheck className={`w-4 h-4 transition-colors duration-300 ${task.completed ? "text-gray-600" : "text-gray-500"}`} />
                        )}
                    </div>
                </div>
            </div>

            {/* Painel de subtarefas (visível sob demanda) */}
            {showSubtasks && (
                <SubtaskList
                    isLoading={isGeneratingSubtasks}
                    subtasks={task.subtasks}
                    onToggleSubtask={handleSubtaskToggle}
                />
            )}
        </div>
    );
}
