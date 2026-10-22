// =============================================================
//  legacyImport.js
//  Importação única dos dados que o desktop guardava antes da
//  sincronização (tarefas no IndexedDB cifrado; projetos, Kanban,
//  anotações e rotinas no localStorage cifrado; perfil em claro) para
//  o armazenamento de registros. Roda uma vez por cofre; os dados
//  antigos ficam onde estavam (rollback possível).
// =============================================================

import { getAllTasks } from "../services/secureStorage";
import { readEncrypted } from "../services/secureLocalStorage";
import { loadProfile } from "../services/profileService";
import { generateId } from "../utils/id";
import { IDEAS_PROJECT_ID, IDEAS_PROJECT_LABEL, INBOX_ID, INBOX_LABEL, NO_TIME } from "./mappers";

export const LEGACY_FLAG = "legacyImportedV1";

const PRIORITY = { low: "low", normal: "medium", high: "high", urgent: "urgent" };
const OLD_DEFAULT_COLUMNS = ["Falta Fazer", "Fazendo", "Feito"];

/** Onde ler os dados antigos; os testes trocam por valores fixos. */
export function legacySources(vaultKey) {
    return {
        loadTasks: () => getAllTasks(vaultKey),
        readCollection: (storageKey) => readEncrypted(vaultKey, storageKey, null),
        loadProfile,
    };
}

const lower = (text) => String(text ?? "").trim().toLocaleLowerCase("pt-BR");

/**
 * @returns {Promise<boolean>} true se importou nesta chamada.
 */
export async function importLegacyData(store, sources, now = () => new Date().toISOString()) {
    if (store.getMeta(LEGACY_FLAG)) return false;

    const [tasks, projects, board, notes, routines] = await Promise.all([
        sources.loadTasks(),
        sources.readCollection("reminder-custom-projects-encrypted"),
        sources.readCollection("reminder_kanban_board"),
        sources.readCollection("reminder_notes"),
        sources.readCollection("reminder-routines-encrypted"),
    ]);
    const profile = sources.loadProfile();
    const at = now();

    store.batch(() => {
        // ── Projetos e subprojetos (ids mantidos) ──
        const topByLabel = new Map();
        const subByKey = new Map();
        let position = 0;
        for (const project of Array.isArray(projects) ? projects : []) {
            if (!project?.id || !project.label) continue;
            position += 1;
            const id = String(project.id);
            store.write("project", id, { name: project.label, color: project.color ?? null, parentId: null, position, createdAt: at });
            topByLabel.set(lower(project.label), id);
            (project.subProjects ?? []).forEach((sub, index) => {
                if (!sub?.id || !sub.label) return;
                store.write("project", String(sub.id), {
                    name: sub.label,
                    color: null,
                    parentId: id,
                    position: index + 1,
                    createdAt: at,
                });
                subByKey.set(`${id}|${lower(sub.label)}`, String(sub.id));
            });
        }

        // Rótulo de tarefa sem projeto correspondente vira projeto (como no desktop de antes).
        function projectIdFor(label, subLabel, color) {
            if (!label || lower(label) === lower(INBOX_LABEL)) return INBOX_ID;
            let topId = topByLabel.get(lower(label));
            if (!topId) {
                topId = lower(label) === lower(IDEAS_PROJECT_LABEL) ? IDEAS_PROJECT_ID : `proj_${generateId()}`;
                position += 1;
                store.write("project", topId, { name: label, color: color ?? null, parentId: null, position, createdAt: at });
                topByLabel.set(lower(label), topId);
            }
            if (!subLabel) return topId;
            const key = `${topId}|${lower(subLabel)}`;
            if (!subByKey.has(key)) {
                const subId = `${topId}__sub_${generateId()}`;
                store.write("project", subId, { name: subLabel, color: null, parentId: topId, position: 1, createdAt: at });
                subByKey.set(key, subId);
            }
            return subByKey.get(key);
        }

        // ── Tarefas ──
        for (const task of Array.isArray(tasks) ? tasks : []) {
            if (task?.id === undefined || task?.id === null) continue;
            const done = !!task.completed;
            store.write("task", String(task.id), {
                projectId: projectIdFor(task.project, task.subProject, task.projectColor),
                title: task.title ?? "",
                description: task.description ?? "",
                dueDate: task.date || null,
                dueTime: task.date && task.time && task.time !== NO_TIME ? task.time : null,
                priority: PRIORITY[task.priority] ?? "medium",
                status: done ? "done" : "todo",
                completedAt: done ? task.completedAt || at : null,
                tags: Array.isArray(task.tags) ? task.tags : [],
                subtasks: Array.isArray(task.subtasks) ? task.subtasks : [],
                estimatedDuration: task.estimatedDuration ?? null,
                reminder: task.reminder ?? null,
                origin: "manual",
                assignee: task.assignee ?? null,
                createdAt: task.createdAt || at,
            });
        }

        // ── O quadro único de antes vira a pasta "Meu quadro" ──
        if (board?.columnOrder && board.columns) {
            const cardCount = Object.keys(board.cards ?? {}).length;
            const titles = board.columnOrder.map((id) => board.columns[id]?.title);
            const customized = cardCount > 0 || titles.join("|") !== OLD_DEFAULT_COLUMNS.join("|");
            if (customized) {
                const boardId = "legacy_board";
                store.write("kanban_board", boardId, { name: "Meu quadro", color: null, position: 1, createdAt: at });
                board.columnOrder.forEach((columnId, columnIndex) => {
                    const column = board.columns[columnId];
                    if (!column) return;
                    store.write("kanban_column", String(columnId), {
                        boardId,
                        title: column.title ?? "Coluna",
                        position: columnIndex + 1,
                        createdAt: at,
                    });
                    (column.cardIds ?? []).forEach((cardId, cardIndex) => {
                        const card = board.cards?.[cardId];
                        if (!card) return;
                        store.write("kanban_card", String(cardId), {
                            boardId,
                            columnId: String(columnId),
                            title: card.title ?? "",
                            description: card.description ?? "",
                            color: card.color ?? null,
                            position: cardIndex + 1,
                            createdAt: typeof card.createdAt === "number" ? new Date(card.createdAt).toISOString() : at,
                        });
                    });
                });
            }
        }

        // ── Anotações ──
        (Array.isArray(notes) ? notes : []).forEach((note, index) => {
            if (!note?.id) return;
            store.write("note", String(note.id), {
                title: note.title ?? "Sem título",
                content: note.content ?? "",
                color: note.color ?? "gray",
                completed: !!note.completed,
                parentId: null,
                position: index + 1,
                createdAt: note.createdAt || at,
            });
        });

        // ── Rotinas ──
        for (const routine of Array.isArray(routines) ? routines : []) {
            if (!routine?.id) continue;
            store.write("routine", String(routine.id), {
                label: routine.label ?? "Rotina",
                time: routine.time ?? "08:00",
                icon: routine.icon ?? "CheckCircle2",
                color: routine.color ?? "text-indigo-400",
                streak: routine.streak ?? 0,
                aiAdjusted: !!routine.aiAdjusted,
                completedDates: Array.isArray(routine.completedDates) ? routine.completedDates : [],
                createdAt: at,
            });
        }

        // ── Perfil ──
        if (profile && (profile.name || profile.email)) {
            store.write("profile", "me", { name: profile.name ?? "", email: profile.email ?? "" });
        }
    });

    store.setMeta(LEGACY_FLAG, at);
    return true;
}
