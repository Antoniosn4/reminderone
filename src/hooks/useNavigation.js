// =============================================================
//  useNavigation.js
//  Custom Hook — Gerencia a view ativa e os dados de configuração
//  da navegação (título, ícone, tipo de view).
//  Totalmente dinâmico: projetos, equipes e rotinas vêm dos hooks.
// =============================================================

import { useState, useCallback } from "react";

/** @typedef {'standard'|'calendar'|'settings'|'routine'|'priorities'|'history'|'notes'|'kanban'} ViewType */

/** Views fixas do sistema — não dependem de dados dinâmicos. */
const STATIC_VIEWS = {
    hoje:           { title: "Hoje",              type: "standard",   filter: "hoje" },
    entrada:        { title: "Caixa de Entrada",  type: "standard",   filter: "entrada" },
    ideias_produto: { title: "Ideias de Produto", type: "standard",   filter: "ideias_produto" },
    prioridades:    { title: "Prioridades",       type: "priorities" },
    calendario:     { title: "Calendário",        type: "calendar" },
    historico:      { title: "Histórico",         type: "history" },
    anotacoes:      { title: "Anotações",         type: "notes" },
    kanban:         { title: "Kanban",            type: "kanban" },
    settings:       { title: "Configurações",     type: "settings" },
};

/**
 * Resolve a configuração da view ativa usando dados dinâmicos.
 *
 * @param {string} view - ID da view ativa
 * @param {Array} projects - Lista de projetos (do useProjects)
 * @param {Array} teams - Lista de equipes (do useTeams)
 * @param {Array} routines - Lista de rotinas (do useRoutines)
 */
function resolveViewConfig(view, projects, teams, routines) {
    // 1. Views estáticas
    if (STATIC_VIEWS[view]) return STATIC_VIEWS[view];

    // 2. Projetos dinâmicos (ex: "frontend", "reunioes", custom...)
    const project = projects.find((p) => p.id === view);
    if (project) {
        return { title: project.label, type: "standard", filter: view };
    }

    // 3. Sub-projetos (ex: "frontend_ds", "marketing_ads")
    for (const p of projects) {
        const sub = p.subProjects?.find((s) => s.id === view);
        if (sub) {
            return {
                title: `${p.label} / ${sub.label}`,
                type: "standard",
                filter: view,
            };
        }
    }

    // 4. Rotinas (ex: "routine_vitaminas", "routine_1234567890")
    const routine = routines.find((r) => r.id === view);
    if (routine) {
        return { title: `Rotina: ${routine.label}`, type: "routine" };
    }

    // Fallback — volta para Hoje
    return STATIC_VIEWS.hoje;
}

/**
 * @param {string} initialView
 * @param {Array} projects
 * @param {Array} teams
 * @param {Array} routines
 */
export function useNavigation(initialView = "hoje", projects = [], teams = [], routines = []) {
    const [activeView, setActiveView] = useState(initialView);

    const navigate = useCallback((view) => {
        setActiveView(view);
    }, []);

    const currentConfig = resolveViewConfig(activeView, projects, teams, routines);

    return {
        activeView,
        navigate,
        viewTitle: currentConfig.title,
        viewType: currentConfig.type,
        viewFilter: currentConfig.filter ?? null,
    };
}
