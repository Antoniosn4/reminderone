// =============================================================
//  Sidebar.jsx
//  Barra lateral completa com navegação multi-view.
//  Totalmente dinâmica — projetos, equipes e rotinas vêm dos hooks.
// =============================================================

import { useState } from "react";
import {
    Mic, Settings, Plus, Search, Inbox, Sun, Calendar, Star,
    AlertCircle, History, Lock, StickyNote, KanbanSquare,
} from "lucide-react";
import { SidebarItem } from "./SidebarItem";
import { SidebarSectionTitle } from "./SidebarSectionTitle";
import { SidebarProjectFolder, SidebarSubProject } from "./SidebarProjectFolder";
// SidebarTeam removed — Teams feature not in v0.1.0
import { SidebarRoutine } from "./SidebarRoutine";
import { renderIcon } from "../../constants/renderIcon";
import { useVault } from "../vault/VaultContext";
import { Avatar } from "../Avatar";

const USER_AVATAR_SIZE_PX = 32;
const DEFAULT_DISPLAY_NAME = "Usuário";

/**
 * @param {{
 *   activeView: string,
 *   onNavigate: (view: string) => void,
 *   isRecording: boolean,
 *   onToggleRecording: () => void,
 *   onQuickAdd: () => void,
 *   onSearch: () => void,
 *   taskCount: number,
 *   projects: Array,
 *   teams: Array,
 *   routines: Array,
 *   onAddProject: () => void,
 *   onEditProject?: (project: object) => void,
 *   onAddTeam: () => void,
 *   onAddRoutine: () => void,
 * }} props
 */
export function Sidebar({
    activeView, onNavigate, isRecording, onToggleRecording,
    onQuickAdd, onSearch, taskCount,
    projects = [], routines = [],
    onAddProject, onEditProject, onAddRoutine,
}) {
    const [expandedFolders, setExpandedFolders] = useState(() => {
        // First project starts expanded by default, rest collapsed
        const init = {};
        projects.forEach((p, i) => { init[p.id] = i === 0; });
        return init;
    });

    const { lock, profile } = useVault();
    const displayName = profile?.name?.trim() || DEFAULT_DISPLAY_NAME;
    const displayEmail = profile?.email?.trim() || "Conta local";

    const toggleFolder = (key) =>
        setExpandedFolders((prev) => ({ ...prev, [key]: !prev[key] }));

    return (
        <aside className="w-[280px] h-screen bg-gray-800 border-r border-gray-700 flex flex-col flex-shrink-0 relative z-10 shadow-2xl">

            <nav className="p-4 space-y-1 flex-1 min-h-0 overflow-y-auto custom-scrollbar">

                {/* Ações rápidas */}
                <div className="mb-6">
                    <SidebarItem icon={<Plus />} label="Nova tarefa" textColor="text-indigo-400" onClick={onQuickAdd} />
                    <SidebarItem icon={<Search />} label="Busca" onClick={onSearch} />
                    <SidebarItem
                        icon={<Inbox />} label="Entrada"
                        badge={taskCount > 0 ? taskCount : null}
                        active={activeView === "entrada"}
                        onClick={() => onNavigate("entrada")}
                    />
                </div>

                {/* Visões de tempo */}
                <div className="pt-2 pb-2">
                    <SidebarItem icon={<Sun />} label="Hoje" active={activeView === "hoje"} onClick={() => onNavigate("hoje")} />
                    <SidebarItem icon={<Calendar />} label="Calendário" active={activeView === "calendario"} onClick={() => onNavigate("calendario")} />
                    <SidebarItem icon={<History />} label="Histórico" active={activeView === "historico"} onClick={() => onNavigate("historico")} />
                    <SidebarItem icon={<StickyNote />} label="Anotações" active={activeView === "anotacoes"} onClick={() => onNavigate("anotacoes")} />
                    <SidebarItem icon={<KanbanSquare />} label="Kanban" active={activeView === "kanban"} onClick={() => onNavigate("kanban")} />
                </div>

                {/* Filtros */}
                <div className="pt-6">
                    <SidebarSectionTitle title="Filtros" />
                    <SidebarItem
                        icon={<AlertCircle className="w-4 h-4 text-rose-500" />}
                        label="Prioridades"
                        active={activeView === "prioridades"}
                        onClick={() => onNavigate("prioridades")}
                    />
                    <SidebarItem
                        icon={<Star className="w-4 h-4 text-yellow-500" />}
                        label="Ideias de Produto"
                        active={activeView === "ideias_produto"}
                        onClick={() => onNavigate("ideias_produto")}
                    />
                </div>

                {/* Projetos dinâmicos */}
                <div className="pt-6">
                    <SidebarSectionTitle title="Meus Projetos" onAdd={onAddProject} />

                    {projects.map((proj) => (
                        <SidebarProjectFolder
                            key={proj.id}
                            color={proj.color}
                            label={proj.label}
                            isExpanded={!!expandedFolders[proj.id]}
                            onToggle={() => toggleFolder(proj.id)}
                            onRoute={() => onNavigate(proj.id)}
                            onEdit={onEditProject ? () => onEditProject(proj) : undefined}
                            active={activeView === proj.id}
                        >
                            {proj.subProjects?.map((sub) => (
                                <SidebarSubProject
                                    key={sub.id}
                                    label={sub.label}
                                    active={activeView === sub.id}
                                    onClick={() => onNavigate(sub.id)}
                                />
                            ))}
                        </SidebarProjectFolder>
                    ))}
                </div>

                {/* Rotinas dinâmicas */}
                <div className="pt-4 pb-6">
                    <SidebarSectionTitle title="Rotina Inteligente" onAdd={onAddRoutine} />
                    {routines.map((routine) => (
                        <SidebarRoutine
                            key={routine.id}
                            icon={renderIcon(routine.icon, `w-4 h-4 ${routine.color}`)}
                            label={routine.label}
                            time={routine.time}
                            streak={routine.streak}
                            aiAdjusted={routine.aiAdjusted}
                            active={activeView === routine.id}
                            onClick={() => onNavigate(routine.id)}
                        />
                    ))}
                </div>
            </nav>

            {/* Rodapé Usuário */}
            <div className="p-4 bg-gray-900 border-t border-gray-700 flex items-center justify-between flex-shrink-0">
                <div
                    className="flex items-center gap-3 cursor-pointer group"
                    onClick={() => onNavigate("settings")}
                >
                    <div className="relative">
                        <div className="rounded-full bg-gradient-to-tr from-indigo-500 to-emerald-400 p-[2px]">
                            <Avatar name={displayName} size={USER_AVATAR_SIZE_PX} />
                        </div>
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-gray-900 rounded-full" />
                    </div>
                    <div className="flex flex-col group-hover:opacity-80 transition-opacity min-w-0">
                        <h3 className="text-sm font-semibold text-gray-100 truncate max-w-[150px]">{displayName}</h3>
                        <p className="text-xs text-gray-500 truncate max-w-[150px]">{displayEmail}</p>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    <button
                        onClick={onToggleRecording}
                        title="Gravar Áudio"
                        className={`p-2 rounded-lg transition-all duration-300 ${
                            isRecording
                                ? "bg-red-500/20 text-red-500 animate-pulse"
                                : "text-gray-400 hover:text-indigo-400 hover:bg-gray-800"
                        }`}
                    >
                        <Mic className="w-5 h-5" />
                    </button>
                    <button
                        onClick={lock}
                        title="Travar vault"
                        className="p-2 rounded-lg transition-colors text-gray-400 hover:text-amber-400 hover:bg-gray-800"
                    >
                        <Lock className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => onNavigate("settings")}
                        title="Configurações"
                        className={`p-2 rounded-lg transition-colors ${
                            activeView === "settings"
                                ? "text-indigo-400 bg-gray-800"
                                : "text-gray-400 hover:text-gray-100 hover:bg-gray-800"
                        }`}
                    >
                        <Settings className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </aside>
    );
}
