// =============================================================
//  SubtaskList.jsx
//  Lista de subtarefas geradas pela IA, exibida abaixo de um TaskItem.
// =============================================================

import { CheckCircle2, Circle, Loader2 } from "lucide-react";

/**
 * @param {{
 *   isLoading: boolean,
 *   subtasks: Array<{ title: string, completed: boolean }>,
 *   onToggleSubtask: (index: number) => void
 * }} props
 */
export function SubtaskList({ isLoading, subtasks, onToggleSubtask }) {
    return (
        <div className="ml-12 mr-4 p-4 rounded-xl bg-gray-800/50 border border-gray-700">
            {isLoading ? (
                <div className="flex items-center gap-3 text-sm text-sky-400 font-medium">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    ✨ A IA está criando os passos...
                </div>
            ) : (
                <div className="space-y-3">
                    {subtasks?.map((subtask, index) => (
                        <div key={index} className="flex items-center gap-3 group/sub">
                            {/* Botão de check com feedback de escala */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleSubtask(index);
                                }}
                                className={`transition-all duration-300 active:scale-90
                                    ${subtask.completed
                                        ? "text-emerald-500 scale-110"
                                        : "text-gray-500 hover:text-gray-200 hover:scale-110"
                                    }`}
                            >
                                {subtask.completed ? (
                                    <CheckCircle2 className="w-4 h-4" />
                                ) : (
                                    <Circle className="w-4 h-4" />
                                )}
                            </button>

                            {/* Risco animado (esquerda → direita) */}
                            <div className="relative w-fit max-w-full">
                                <span
                                    className={`text-sm block truncate transition-colors duration-300
                                        ${subtask.completed ? "text-gray-500" : "text-gray-300"}`}
                                >
                                    {subtask.title}
                                </span>
                                <span
                                    className={`absolute left-0 top-1/2 -mt-px h-[1.5px] w-full bg-gray-500
                                        transition-transform duration-300 ease-out origin-left
                                        ${subtask.completed ? "scale-x-100" : "scale-x-0"}`}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
