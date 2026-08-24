// =============================================================
//  CalendarDayModal.jsx
//  Modal que mostra a agenda de um dia específico do calendário,
//  ordenada por horário em formato de timeline.
//  Reutiliza TaskItem para que o usuário consiga marcar/editar/excluir
//  diretamente da visão diária.
// =============================================================

import { useEffect, useMemo, useCallback } from "react";
import { Calendar, X, CheckCircle2 } from "lucide-react";
import { TaskItem } from "../TaskList/TaskItem";

const MONTH_NAMES = [
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

const HHMM_REGEX = /^([01]?\d|2[0-3]):[0-5]\d$/;

/**
 * Formata "YYYY-MM-DD" → "DD de Mês de YYYY", sem depender de Date()
 * (parsing literal evita problemas de fuso ao construir Date a partir de
 * string ISO de data pura).
 */
function formatDate(isoDate) {
    const parts = isoDate.split("-");
    if (parts.length !== 3) return isoDate;
    const [year, month, day] = parts;
    const monthIndex = Number(month) - 1;
    if (Number.isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) return isoDate;
    return `${day} de ${MONTH_NAMES[monthIndex]} de ${year}`;
}

/**
 * Tarefas com horário válido (HH:MM) vêm primeiro em ordem cronológica.
 * Tarefas sem horário ou rótulos genéricos vão para o fim.
 */
function compareByTime(a, b) {
    const aHasTime = HHMM_REGEX.test(a.time ?? "");
    const bHasTime = HHMM_REGEX.test(b.time ?? "");
    if (aHasTime && bHasTime) return a.time.localeCompare(b.time);
    if (aHasTime) return -1;
    if (bHasTime) return 1;
    return (a.title ?? "").localeCompare(b.title ?? "");
}

/**
 * @param {{
 *   date: string | null,
 *   tasks: Array,
 *   onClose: () => void,
 *   onToggleTask: (id: number) => void,
 *   onUpdateTask: (id: number, updates: object) => void,
 *   onDeleteTask: (id: number) => void,
 *   onGenerateSubtasks: (id: number, title: string) => Promise<any>,
 *   onToggleSubtask: (taskId: number, index: number) => void,
 *   onEditTask: (task: object) => void,
 * }} props
 */
export function CalendarDayModal({
    date,
    tasks,
    onClose,
    onToggleTask,
    onUpdateTask,
    onDeleteTask,
    onGenerateSubtasks,
    onToggleSubtask,
    onEditTask,
}) {
    const isOpen = Boolean(date);

    const sortedTasks = useMemo(() => {
        if (!date) return [];
        return tasks
            .filter((task) => task.date === date)
            .slice()
            .sort(compareByTime);
    }, [date, tasks]);

    const handleBackdropClick = useCallback(
        (event) => {
            if (event.target === event.currentTarget) onClose();
        },
        [onClose],
    );

    useEffect(() => {
        if (!isOpen) return undefined;
        const handleKey = (event) => {
            if (event.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const formattedDate = formatDate(date);
    const completedCount = sortedTasks.filter((task) => task.completed).length;
    const pendingCount = sortedTasks.length - completedCount;

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="calendar-day-modal-title"
            onClick={handleBackdropClick}
            className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200"
        >
            <div
                className="bg-gray-800 border border-gray-700 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden shadow-black/50 flex flex-col max-h-[85vh]"
                onClick={(event) => event.stopPropagation()}
            >
                <header className="flex items-center justify-between p-6 border-b border-gray-700 bg-gray-800/80">
                    <div className="flex items-center gap-3 min-w-0">
                        <Calendar className="w-5 h-5 text-indigo-400 flex-shrink-0" />
                        <h2
                            id="calendar-day-modal-title"
                            className="text-lg font-bold text-gray-100 truncate"
                        >
                            Agenda — {formattedDate}
                        </h2>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-400 hidden sm:inline">
                            {pendingCount > 0
                                ? `${pendingCount} pendente${pendingCount === 1 ? "" : "s"}`
                                : "Tudo em dia"}
                            {completedCount > 0 && ` • ${completedCount} concluída${completedCount === 1 ? "" : "s"}`}
                        </span>
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Fechar"
                            className="text-gray-500 hover:text-gray-300 transition-colors p-1.5 rounded-lg hover:bg-gray-700"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </header>

                <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-gray-900/50">
                    {sortedTasks.length === 0 ? (
                        <div className="text-center py-16 text-gray-500 flex flex-col items-center">
                            <CheckCircle2 className="w-12 h-12 mb-4 opacity-20" />
                            <h3 className="text-lg font-bold text-gray-400 mb-2">Dia livre!</h3>
                            <p className="text-sm max-w-md">
                                Nenhuma tarefa ou lembrete agendado para esta data.
                            </p>
                        </div>
                    ) : (
                        <ol className="relative border-l-2 border-gray-700/50 ml-4 pl-6 space-y-5">
                            {sortedTasks.map((task) => (
                                <li key={task.id} className="relative">
                                    <span
                                        aria-hidden="true"
                                        className={`absolute -left-[31px] top-[26px] w-3 h-3 rounded-full bg-gray-900 border-2 ${
                                            task.completed ? "border-emerald-500" : "border-indigo-500"
                                        }`}
                                    />
                                    <TaskItem
                                        task={task}
                                        onToggleTask={onToggleTask}
                                        onUpdateTask={onUpdateTask}
                                        onDeleteTask={onDeleteTask}
                                        onGenerateSubtasks={onGenerateSubtasks}
                                        onToggleSubtask={onToggleSubtask}
                                        onEditTask={onEditTask}
                                    />
                                </li>
                            ))}
                        </ol>
                    )}
                </div>
            </div>
        </div>
    );
}
