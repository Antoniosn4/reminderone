// =============================================================
//  GenericTeamView.jsx
//  View unificada para TODAS as equipes (dinâmicas e legadas).
//  Mostra tarefas reais atribuídas ao time via @mention.
// =============================================================

import { useMemo } from "react";
import { Users, CheckCircle2 } from "lucide-react";
import { Avatar } from "../Avatar";
import { TaskItem } from "../TaskList/TaskItem";
import { EmptyState } from "../EmptyState";

const TEAM_AVATAR_SIZE_PX = 40;
const MAX_VISIBLE_TEAM_AVATARS = 5;

/**
 * @param {{
 *   team: object,
 *   tasks?: Array,
 *   onToggleTask?: Function,
 *   onUpdateTask?: Function,
 *   onDeleteTask?: Function,
 *   onGenerateSubtasks?: Function,
 *   onToggleSubtask?: Function,
 *   onEditTask?: Function,
 * }} props
 */
export function GenericTeamView({ team, tasks = [], ...taskHandlers }) {
    if (!team) return null;

    const visibleAvatarCount = Math.min(team.members, MAX_VISIBLE_TEAM_AVATARS);

    // Filtra tarefas atribuídas a este time (por assignee contendo nome do time)
    const teamTasks = useMemo(() => {
        const teamName = team.name?.toLowerCase() || "";
        return tasks.filter((t) => {
            const assignee = (t.assignee || "").toLowerCase();
            const project = (t.project || "").toLowerCase();
            return assignee.includes(teamName) || project.includes(teamName);
        });
    }, [tasks, team.name]);

    const pendingTasks = useMemo(() => teamTasks.filter((t) => !t.completed), [teamTasks]);
    const completedCount = teamTasks.length - pendingTasks.length;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
            {/* Header da equipe */}
            <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 shadow-xl flex items-center justify-between">
                <div className="flex items-center gap-6">
                    <div className="p-3 bg-gray-700/50 rounded-xl border border-gray-600/50">
                        <Users className="w-6 h-6 text-gray-400" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-gray-100">{team.name}</h2>
                        <p className="text-sm text-gray-400 mt-1">{team.members} membros no espaço</p>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    {/* Métricas reais */}
                    <div className="flex gap-4">
                        <div className="text-center">
                            <span className="block text-2xl font-bold text-gray-100">{pendingTasks.length}</span>
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Pendentes</span>
                        </div>
                        <div className="text-center">
                            <span className="block text-2xl font-bold text-emerald-400">{completedCount}</span>
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Concluídas</span>
                        </div>
                    </div>

                    {/* Avatares */}
                    <div className="flex items-center -space-x-3">
                        {Array.from({ length: visibleAvatarCount }).map((_, i) => (
                            <Avatar
                                key={i}
                                seed={`${team.name}-${i}`}
                                size={TEAM_AVATAR_SIZE_PX}
                                className="border-2 border-gray-800"
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* Lista de tarefas pendentes */}
            {pendingTasks.length > 0 && (
                <div>
                    <h3 className="text-sm font-semibold text-gray-400 mb-4 px-1">
                        Tarefas pendentes
                    </h3>
                    <div className="space-y-3">
                        {pendingTasks.map((task) => (
                            <TaskItem key={task.id} task={task} {...taskHandlers} />
                        ))}
                    </div>
                </div>
            )}

            {/* Empty state quando não há tarefas */}
            {teamTasks.length === 0 && (
                <div className="bg-gray-800/20 border border-dashed border-gray-700 rounded-2xl">
                    <EmptyState
                        icon={Users}
                        title="Espaço configurado com sucesso"
                        description={`O ambiente para ${team.name} está pronto. Delegue tarefas com @menções ou atribua o projeto "${team.name}" para visualizar aqui.`}
                    />
                </div>
            )}

            {/* Tarefas concluídas */}
            {completedCount > 0 && (
                <div className="mt-6">
                    <h3 className="text-sm font-semibold text-gray-500 border-b border-gray-800 pb-2 mb-4">
                        Concluídas ({completedCount})
                    </h3>
                    <div className="space-y-3 opacity-60 hover:opacity-100 transition-opacity duration-500">
                        {teamTasks.filter((t) => t.completed).map((task) => (
                            <TaskItem key={task.id} task={task} {...taskHandlers} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
