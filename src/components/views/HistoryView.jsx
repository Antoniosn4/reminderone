// =============================================================
//  HistoryView.jsx
//  Registro de tarefas concluídas, agrupadas por data de conclusão.
//  Permite reabrir, editar ou excluir entradas históricas.
// =============================================================

import { useMemo } from "react";
import { History, CheckCircle2, Flame } from "lucide-react";
import { TaskItem } from "../TaskList/TaskItem";
import { EmptyState } from "../EmptyState";

const DATE_FORMAT_OPTIONS = { weekday: "long", day: "numeric", month: "long" };

function formatHumanDate(isoDate) {
    if (!isoDate) return "Sem data";
    try {
        const formatted = new Date(`${isoDate}T12:00:00`)
            .toLocaleDateString("pt-BR", DATE_FORMAT_OPTIONS);
        return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    } catch {
        return isoDate;
    }
}

/**
 * Agrupa tarefas concluídas pela data declarada e ordena
 * grupos da mais recente para a mais antiga.
 */
function groupByDate(tasks) {
    const groups = new Map();

    for (const task of tasks) {
        const key = task.date || "sem-data";
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(task);
    }

    return [...groups.entries()]
        .sort(([a], [b]) => (a < b ? 1 : -1))
        .map(([date, items]) => ({ date, items }));
}

function computeStreakDays(completedTasks) {
    const uniqueDays = new Set(
        completedTasks.map((t) => t.date).filter(Boolean),
    );
    return uniqueDays.size;
}

/**
 * @param {{
 *   tasks: Array,
 *   onToggleTask: Function,
 *   onUpdateTask: Function,
 *   onDeleteTask: Function,
 *   onGenerateSubtasks: Function,
 *   onToggleSubtask: Function,
 *   onEditTask: Function,
 * }} props
 */
export function HistoryView({ tasks, ...taskHandlers }) {
    const completedTasks = useMemo(
        () => tasks.filter((t) => t.completed),
        [tasks],
    );

    const groups = useMemo(() => groupByDate(completedTasks), [completedTasks]);
    const streakDays = useMemo(() => computeStreakDays(completedTasks), [completedTasks]);

    if (completedTasks.length === 0) {
        return (
            <div className="pt-2 animate-in fade-in slide-in-from-bottom-4">
                <div className="bg-gray-800/20 border border-dashed border-gray-700 rounded-2xl">
                    <EmptyState
                        icon={History}
                        title="Histórico vazio"
                        description="Você ainda não concluiu nenhuma tarefa. Suas vitórias aparecerão aqui."
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="pt-2 space-y-8 animate-in fade-in slide-in-from-bottom-4">

            {/* Cabeçalho com métricas reais */}
            <header className="bg-gray-800 border border-gray-700 rounded-2xl p-6 shadow-xl flex items-center justify-between">
                <div className="flex items-center gap-6">
                    <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                        <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-gray-100">Registro de Atividades</h2>
                        <p className="text-sm text-gray-400 mt-1">
                            Tudo que você já finalizou — disponível para consulta e reabertura.
                        </p>
                    </div>
                </div>

                <div className="flex gap-6">
                    <Metric
                        value={completedTasks.length}
                        label="Concluídas"
                        accent="text-emerald-400"
                    />
                    <Metric
                        value={streakDays}
                        label="Dias produtivos"
                        accent="text-orange-400"
                        icon={<Flame className="w-4 h-4" />}
                    />
                </div>
            </header>

            {/* Grupos por data */}
            {groups.map(({ date, items }) => (
                <section key={date}>
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">
                        {formatHumanDate(date)}
                        <span className="ml-2 text-gray-600 font-medium normal-case tracking-normal">
                            • {items.length} {items.length === 1 ? "tarefa" : "tarefas"}
                        </span>
                    </h3>
                    <div className="space-y-3">
                        {items.map((task) => (
                            <TaskItem key={task.id} task={task} {...taskHandlers} />
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
}

function Metric({ value, label, accent, icon }) {
    return (
        <div className="text-center px-6 border-l border-gray-700">
            <span className={`flex items-center justify-center gap-1.5 text-3xl font-extrabold ${accent}`}>
                {icon}
                {value}
            </span>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                {label}
            </span>
        </div>
    );
}
