// =============================================================
//  taskSchema.js
//  Schema canônico de uma tarefa.
//  Fonte de verdade para ambos desktop e mobile — todos os campos
//  que uma tarefa pode ter, com valores padrão e helpers de
//  criação / normalização.
//
//  Qualquer campo novo DEVE ser adicionado aqui primeiro e depois
//  propagado para os componentes de UI e serviços.
// =============================================================

import { generateId } from "../utils/id";
import { localDateISO } from "../data/mappers";

// ── Constantes de prioridade ─────────────────────────────────────

export const PRIORITY_LEVELS = Object.freeze({
    LOW: "low",
    NORMAL: "normal",
    HIGH: "high",
    URGENT: "urgent",
});

export const PRIORITY_META = Object.freeze([
    {
        id: PRIORITY_LEVELS.LOW,
        label: "Baixa",
        colorClass: "hover:border-blue-500/50 hover:bg-blue-500/10",
        activeClass: "border-blue-500 bg-blue-500/20 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.2)]",
        badgeColor: "text-blue-400",
        badgeBg: "bg-blue-500/10",
        badgeBorder: "border-blue-500/20",
    },
    {
        id: PRIORITY_LEVELS.NORMAL,
        label: "Média",
        colorClass: "hover:border-emerald-500/50 hover:bg-emerald-500/10",
        activeClass: "border-emerald-500 bg-emerald-500/20 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]",
        badgeColor: "text-emerald-400",
        badgeBg: "bg-emerald-500/10",
        badgeBorder: "border-emerald-500/20",
    },
    {
        id: PRIORITY_LEVELS.HIGH,
        label: "Alta",
        colorClass: "hover:border-orange-500/50 hover:bg-orange-500/10",
        activeClass: "border-orange-500 bg-orange-500/20 text-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.2)]",
        badgeColor: "text-orange-400",
        badgeBg: "bg-orange-500/10",
        badgeBorder: "border-orange-500/20",
    },
    {
        id: PRIORITY_LEVELS.URGENT,
        label: "Urgente",
        colorClass: "hover:border-red-500/50 hover:bg-red-500/10",
        activeClass: "border-red-500 bg-red-500/20 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.2)]",
        badgeColor: "text-red-400",
        badgeBg: "bg-red-500/10",
        badgeBorder: "border-red-500/20",
    },
]);

// ── Projeto padrão ───────────────────────────────────────────────

export const DEFAULT_PROJECT = Object.freeze({
    label: "Entrada",
    color: "#6b7280",
});

// ── Schema da tarefa (todos os campos) ───────────────────────────

/**
 * Cria uma tarefa com todos os campos preenchidos com valores padrão.
 * Use esta função sempre que criar uma tarefa nova para garantir
 * consistência do modelo de dados entre desktop e mobile.
 *
 * @param {Partial<Task>} overrides — campos a sobrescrever
 * @returns {Task}
 */
export function createTask(overrides = {}) {
    const now = new Date().toISOString();
    const today = localDateISO();

    return {
        // ── Identificação ──
        id: generateId(),

        // ── Conteúdo ──
        title: "",
        description: "",

        // ── Temporalidade ──
        date: today,
        time: "Sem horário",
        reminder: null,           // ISO string ou null — quando notificar
        estimatedDuration: null,  // minutos (número) ou null

        // ── Organização ──
        project: DEFAULT_PROJECT.label,
        projectColor: DEFAULT_PROJECT.color,
        subProject: null,         // string ou null
        tags: [],                 // array de strings
        priority: PRIORITY_LEVELS.NORMAL,

        // ── Atribuição ──
        assignee: null,           // { name: string } ou null

        // ── Estado ──
        completed: false,
        completedAt: null,        // ISO string ou null

        // ── Subtarefas ──
        subtasks: [],             // [{ title: string, completed: boolean }]

        // ── Metadados ──
        createdAt: now,
        updatedAt: now,

        // ── Overrides do caller ──
        ...overrides,
    };
}

/**
 * Normaliza uma tarefa carregada do storage para o schema atual.
 * Garante que tarefas antigas (sem campos novos) recebam os padrões
 * corretos, permitindo migração zero-downtime.
 *
 * @param {object} rawTask — tarefa como veio do IndexedDB
 * @returns {Task}
 */
export function normalizeTask(rawTask) {
    return {
        // Aplica defaults primeiro, depois sobrescreve com dados reais
        ...createTask(),
        ...rawTask,
        // Garante arrays (nunca undefined)
        tags: Array.isArray(rawTask.tags) ? rawTask.tags : [],
        subtasks: Array.isArray(rawTask.subtasks) ? rawTask.subtasks : [],
    };
}

/**
 * Retorna o label humano da prioridade.
 * @param {string} priorityId
 * @returns {string}
 */
export function getPriorityLabel(priorityId) {
    return PRIORITY_META.find((p) => p.id === priorityId)?.label ?? "Média";
}
