// =============================================================
//  CalendarView.jsx
//  View do calendário mensal DINÂMICO com navegação de meses.
//  Calcula mês, ano, padding e dias com base em Date() real.
// =============================================================

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { localDateISO } from "../../data/mappers";

const DAYS_OF_WEEK = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTH_NAMES = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/**
 * @param {{
 *   tasks: Array,
 *   onMonthChange?: (year: number, month: number) => void,
 *   onDayClick?: (isoDate: string) => void,
 * }} props
 */
export function CalendarView({ tasks, onDayClick }) {
    const now = new Date();
    const [viewYear, setViewYear] = useState(now.getFullYear());
    const [viewMonth, setViewMonth] = useState(now.getMonth()); // 0-indexed

    const todayISO = localDateISO(now);

    // Primeiro dia do mês (0=Dom, 1=Seg, ...)
    const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
    // Total de dias no mês
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    const paddedDays = [
        ...Array(firstDayOfWeek).fill(null),
        ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];

    const goToPrevMonth = () => {
        setViewMonth((prev) => {
            if (prev === 0) { setViewYear((y) => y - 1); return 11; }
            return prev - 1;
        });
    };

    const goToNextMonth = () => {
        setViewMonth((prev) => {
            if (prev === 11) { setViewYear((y) => y + 1); return 0; }
            return prev + 1;
        });
    };

    const goToToday = () => {
        setViewYear(now.getFullYear());
        setViewMonth(now.getMonth());
    };

    const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth();

    return (
        <div className="bg-gray-800 border border-gray-700 rounded-2xl overflow-hidden shadow-2xl flex flex-col animate-in fade-in duration-300">

            {/* Cabeçalho com navegação */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 bg-gray-900/50">
                <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold text-gray-100">
                        {MONTH_NAMES[viewMonth]} {viewYear}
                    </h2>
                    {!isCurrentMonth && (
                        <button
                            onClick={goToToday}
                            className="text-xs font-semibold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-lg hover:bg-indigo-500/20 transition-colors"
                        >
                            Hoje
                        </button>
                    )}
                </div>
                <div className="flex gap-1">
                    <button
                        onClick={goToPrevMonth}
                        className="p-1.5 bg-gray-800 hover:bg-gray-700 rounded-md border border-gray-700 text-gray-400 hover:text-gray-100 transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                        onClick={goToNextMonth}
                        className="p-1.5 bg-gray-800 hover:bg-gray-700 rounded-md border border-gray-700 text-gray-400 hover:text-gray-100 transition-colors"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Cabeçalho dos dias da semana */}
            <div className="grid grid-cols-7 border-b border-gray-700 bg-gray-900/30">
                {DAYS_OF_WEEK.map((day) => (
                    <div
                        key={day}
                        className="py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider"
                    >
                        {day}
                    </div>
                ))}
            </div>

            {/* Grade de dias */}
            <div className="grid grid-cols-7 bg-gray-700 gap-px">
                {paddedDays.map((day, idx) => {
                    const dateStr = day
                        ? `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                        : null;
                    const isToday = dateStr === todayISO;
                    const dayTasks = dateStr
                        ? tasks.filter((t) => t.date === dateStr)
                        : [];

                    const isClickable = Boolean(day && onDayClick);
                    const handleClick = () => {
                        if (isClickable && dateStr) onDayClick(dateStr);
                    };
                    const handleKeyDown = (event) => {
                        if (!isClickable) return;
                        if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            handleClick();
                        }
                    };

                    return (
                        <div
                            key={idx}
                            role={isClickable ? "button" : undefined}
                            tabIndex={isClickable ? 0 : undefined}
                            aria-label={
                                isClickable
                                    ? `Abrir agenda de ${day}/${viewMonth + 1}/${viewYear} (${dayTasks.length} tarefa${dayTasks.length === 1 ? "" : "s"})`
                                    : undefined
                            }
                            onClick={handleClick}
                            onKeyDown={handleKeyDown}
                            className={`min-h-[120px] bg-gray-900 p-2 transition-colors group focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500/40 ${
                                isClickable ? "cursor-pointer hover:bg-gray-800/80" : ""
                            } ${isToday ? "bg-gray-800/40 ring-1 ring-inset ring-indigo-500/30" : ""}`}
                        >
                            {day && (
                                <div className="flex flex-col h-full">
                                    <div className="flex justify-between items-start mb-2">
                                        <span
                                            className={`text-sm font-semibold flex items-center justify-center w-7 h-7 rounded-full ${
                                                isToday
                                                    ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/30"
                                                    : "text-gray-400 group-hover:text-gray-200"
                                            }`}
                                        >
                                            {day}
                                        </span>
                                        {dayTasks.length > 0 && (
                                            <span className="text-[10px] font-bold text-gray-500 bg-gray-800 px-1.5 rounded">
                                                {dayTasks.length}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex flex-col gap-1 flex-1 overflow-y-auto hide-scrollbar">
                                        {dayTasks.slice(0, 3).map((task) => (
                                            <div
                                                key={task.id}
                                                className="px-2 py-1 rounded-md border text-[11px] font-medium leading-tight truncate cursor-pointer transition-transform hover:-translate-y-px"
                                                style={{
                                                    backgroundColor: `${task.projectColor}15`,
                                                    borderColor: `${task.projectColor}30`,
                                                    color: task.projectColor,
                                                }}
                                                title={`${task.time} — ${task.title}`}
                                            >
                                                {task.time !== "Sem horário" && (
                                                    <span className="opacity-70 mr-1">{task.time}</span>
                                                )}
                                                {task.title}
                                            </div>
                                        ))}
                                        {dayTasks.length > 3 && (
                                            <span className="text-[10px] text-gray-500 text-center">
                                                +{dayTasks.length - 3} mais
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
