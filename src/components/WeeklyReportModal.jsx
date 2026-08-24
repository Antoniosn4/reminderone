// =============================================================
//  WeeklyReportModal.jsx
//  Modal de Revisão Semanal com distribuição de foco REAL
//  calculada a partir das tarefas concluídas nos últimos 7 dias.
// =============================================================

import { useMemo } from "react";
import { X, BarChart2, TrendingUp, CheckCircle2 } from "lucide-react";

/** Cor atribuída a cada projeto na barra de distribuição. */
const PROJECT_COLORS = [
    "bg-indigo-500", "bg-blue-500", "bg-emerald-500",
    "bg-rose-500", "bg-amber-500", "bg-cyan-500",
    "bg-pink-500", "bg-violet-400",
];

function getWeekAgoISO() {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
}

function computeFocusDistribution(tasks) {
    const weekAgo = getWeekAgoISO();
    const recentCompleted = tasks.filter(
        (t) => t.completed && t.date && t.date >= weekAgo,
    );

    if (recentCompleted.length === 0) return [];

    const counts = {};
    for (const t of recentCompleted) {
        const project = t.project || "Sem projeto";
        counts[project] = (counts[project] || 0) + 1;
    }

    const total = recentCompleted.length;
    return Object.entries(counts)
        .sort(([, a], [, b]) => b - a)
        .map(([label, count], i) => ({
            label,
            percentage: Math.round((count / total) * 100),
            color: PROJECT_COLORS[i % PROJECT_COLORS.length],
        }));
}

function generateInsight(distribution, totalCompleted) {
    if (totalCompleted === 0) {
        return "Nenhuma tarefa concluída nos últimos 7 dias. Que tal começar pela mais simples?";
    }
    if (distribution.length === 1) {
        return `Foco total em "${distribution[0].label}" esta semana — ${totalCompleted} tarefa(s) concluída(s). Considere diversificar.`;
    }
    const top = distribution[0];
    return `Você completou ${totalCompleted} tarefa(s) esta semana. Foco principal em "${top.label}" (${top.percentage}%).`;
}

// ----- Sub-componente: Barra de progresso -----

function FocusBar({ label, percentage, color }) {
    return (
        <div>
            <div className="flex justify-between text-xs mb-1 text-gray-300">
                <span>{label}</span>
                <span>{percentage}%</span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-1.5">
                <div
                    className={`h-1.5 rounded-full ${color} transition-all duration-500`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
}

/**
 * @param {{ isOpen: boolean, onClose: () => void, tasks: Array }} props
 */
export function WeeklyReportModal({ isOpen, onClose, tasks = [] }) {
    const distribution = useMemo(() => computeFocusDistribution(tasks), [tasks]);

    const weekAgo = getWeekAgoISO();
    const totalCompleted = useMemo(
        () => tasks.filter((t) => t.completed && t.date && t.date >= weekAgo).length,
        [tasks, weekAgo],
    );

    const insight = useMemo(
        () => generateInsight(distribution, totalCompleted),
        [distribution, totalCompleted],
    );

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Cabeçalho */}
                <header className="p-5 border-b border-gray-800 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-gray-100 flex items-center gap-2">
                        <BarChart2 className="w-5 h-5 text-indigo-400" />
                        Revisão Semanal
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-300 transition-colors"
                        title="Fechar"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </header>

                {/* Corpo */}
                <div className="p-6 space-y-6">
                    {/* Métricas */}
                    <div className="flex items-center gap-6">
                        <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                        </div>
                        <div>
                            <span className="text-3xl font-extrabold text-gray-100">{totalCompleted}</span>
                            <p className="text-sm text-gray-400 mt-0.5">tarefas concluídas nos últimos 7 dias</p>
                        </div>
                    </div>

                    {/* Distribuição de foco */}
                    {distribution.length > 0 && (
                        <section>
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <TrendingUp className="w-4 h-4" /> Distribuição de Foco
                            </h3>
                            <div className="space-y-3">
                                {distribution.map((item) => (
                                    <FocusBar key={item.label} {...item} />
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Insight real */}
                    <section className="p-4 bg-gray-800/50 rounded-xl border border-gray-700/50">
                        <p className="text-gray-400 text-sm leading-relaxed">{insight}</p>
                    </section>
                </div>
            </div>
        </div>
    );
}
