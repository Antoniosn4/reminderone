// =============================================================
//  GenericRoutineView.jsx
//  View genérica para rotinas dinâmicas. Histórico semanal real
//  baseado em `routine.completedDates` (sem dados mockados).
// =============================================================

import { useMemo } from "react";
import { Check, Pencil } from "lucide-react";
import { renderIcon } from "../../constants/renderIcon";
import { localDateISO } from "../../data/mappers";

const WEEK_DAYS_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function isoDayOf(date) {
    return localDateISO(date);
}

/**
 * Retorna a sequência dos últimos 7 dias terminando hoje, do mais antigo
 * para o mais recente. Cada item inclui o ISO date e a flag de conclusão.
 */
function buildWeekHistory(completedDates) {
    const completedSet = new Set(completedDates ?? []);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const items = [];
    for (let offset = 6; offset >= 0; offset -= 1) {
        const date = new Date(today);
        date.setDate(today.getDate() - offset);
        const iso = isoDayOf(date);
        const dayIndex = (date.getDay() + 6) % 7; // 0=Seg ... 6=Dom
        items.push({
            iso,
            label: WEEK_DAYS_LABELS[dayIndex],
            isToday: offset === 0,
            isDone: completedSet.has(iso),
        });
    }
    return items;
}

/**
 * @param {{
 *   routine: object,
 *   onToggleToday?: (id: string) => void,
 *   onEdit?: (routine: object) => void,
 * }} props
 */
export function GenericRoutineView({ routine, onToggleToday, onEdit }) {
    const history = useMemo(
        () => buildWeekHistory(routine?.completedDates),
        [routine?.completedDates],
    );
    // Depois dos hooks: a rotina pode sumir (excluída no celular) com a tela aberta.
    if (!routine) return null;
    const isDoneToday = history[history.length - 1]?.isDone ?? false;

    return (
        <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-gray-800 border border-gray-700 rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center relative overflow-hidden">
                {onEdit && (
                    <button
                        onClick={() => onEdit(routine)}
                        title="Editar rotina"
                        className="absolute top-4 right-4 flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-gray-100 bg-gray-900 hover:bg-gray-700 border border-gray-700 px-3 py-1.5 rounded-lg transition-colors"
                    >
                        <Pencil className="w-3.5 h-3.5" /> Editar
                    </button>
                )}
                <div className="w-20 h-20 bg-gray-900 border border-gray-700 rounded-full flex items-center justify-center mb-6 shadow-lg">
                    {renderIcon(routine.icon, `w-10 h-10 ${routine.color}`)}
                </div>
                <h2 className="text-2xl font-bold text-gray-100 mb-2">{routine.label}</h2>
                <p className="text-gray-400 text-sm mb-8">
                    Todos os dias às{" "}
                    <span className="text-gray-200 font-bold bg-gray-900 px-2 py-0.5 rounded border border-gray-700">
                        {routine.time}
                    </span>
                </p>

                <div className="flex items-center gap-3 w-full justify-center mb-10">
                    {history.map((day) => (
                        <div key={day.iso} className="flex flex-col items-center gap-2">
                            <span className={`text-xs font-bold ${day.isToday ? routine.color : "text-gray-500"}`}>
                                {day.label}
                            </span>
                            <div
                                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                                    day.isDone
                                        ? `bg-gray-700 ${routine.color} shadow-md`
                                        : day.isToday
                                            ? "bg-gray-900 border-2 border-gray-600"
                                            : "bg-gray-900 border border-gray-700"
                                }`}
                                title={day.iso}
                            >
                                {day.isDone && <Check className="w-5 h-5" />}
                            </div>
                        </div>
                    ))}
                </div>

                <button
                    onClick={() => onToggleToday?.(routine.id)}
                    disabled={!onToggleToday}
                    className={`w-full max-w-sm py-4 rounded-2xl font-bold text-lg transition-all duration-300 transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                        isDoneToday
                            ? "bg-gray-900 border border-gray-700 text-emerald-400"
                            : "bg-gray-700 hover:bg-gray-600 text-white shadow-xl"
                    }`}
                >
                    {isDoneToday ? "Concluído por hoje!" : "Marcar como feito"}
                </button>
            </div>
        </div>
    );
}
