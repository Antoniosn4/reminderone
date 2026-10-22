// =============================================================
//  mappers.js
//  Conversão entre os registros do protocolo (docs/SYNC_PROTOCOL.md)
//  e os objetos que as telas do desktop já usam. Assim as views e os
//  modais continuam iguais; só a fonte dos dados mudou.
//
//  Vocabulário do protocolo ↔ desktop:
//    prioridade medium ↔ normal; etapa done ↔ completed;
//    dueTime null ↔ "Sem horário"; projectId ↔ rótulo do projeto
//    ("inbox" = "Entrada"); subprojeto = projeto com parentId.
// =============================================================

export const INBOX_ID = "inbox";
export const INBOX_LABEL = "Entrada";
export const INBOX_COLOR = "#6b7280";
export const NO_TIME = "Sem horário";
/** Id fixo para a lista "Ideias de Produto" do desktop: o mesmo em todo aparelho. */
export const IDEAS_PROJECT_ID = "ideias_produto";
export const IDEAS_PROJECT_LABEL = "Ideias de Produto";

const TO_CANONICAL_PRIORITY = { low: "low", normal: "medium", high: "high", urgent: "urgent" };
const TO_DESKTOP_PRIORITY = { low: "low", medium: "normal", high: "high", urgent: "urgent" };

/** "AAAA-MM-DD" no fuso do computador (toISOString seria UTC e erraria o dia à noite). */
export function localDateISO(date = new Date()) {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
}

export function byPosition(a, b) {
    const diff = (a.position ?? 0) - (b.position ?? 0);
    if (diff !== 0) return diff;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

// ── Projetos ─────────────────────────────────────────────────

/** Formato da barra lateral: projetos raiz com `subProjects`. */
export function projectsToDesktop(projectRecords) {
    const roots = projectRecords.filter((p) => !p.parentId && p.id !== INBOX_ID).sort(byPosition);
    return roots.map((root) => ({
        id: root.id,
        label: root.name ?? "",
        color: root.color ?? INBOX_COLOR,
        subProjects: projectRecords
            .filter((p) => p.parentId === root.id)
            .sort(byPosition)
            .map((sub) => ({ id: sub.id, label: sub.name ?? "" })),
    }));
}

// ── Tarefas ──────────────────────────────────────────────────

export function taskToDesktop(record, projectsById) {
    const project = projectsById.get(record.projectId);
    const parent = project?.parentId ? projectsById.get(project.parentId) : null;
    const top = parent ?? project;
    return {
        id: record.id,
        title: record.title ?? "",
        description: record.description ?? "",
        date: record.dueDate ?? null,
        time: record.dueTime ?? NO_TIME,
        reminder: record.reminder ?? null,
        estimatedDuration: record.estimatedDuration ?? null,
        project: top ? top.name : INBOX_LABEL,
        projectColor: top?.color ?? INBOX_COLOR,
        projectId: record.projectId ?? INBOX_ID,
        subProject: parent ? project.name : null,
        tags: Array.isArray(record.tags) ? record.tags : [],
        priority: TO_DESKTOP_PRIORITY[record.priority] ?? "normal",
        assignee: record.assignee ?? null,
        status: record.status ?? "todo",
        completed: record.status === "done",
        completedAt: record.completedAt ?? null,
        subtasks: Array.isArray(record.subtasks) ? record.subtasks : [],
        origin: record.origin ?? "manual",
        createdAt: record.createdAt ?? record.updatedAt,
        updatedAt: record.updatedAt,
    };
}

/**
 * Campos do desktop (formulário, IA, edição inline) → campos do protocolo.
 * Só converte o que veio em `fields`; o resto do registro fica como está.
 *
 * @param {object} fields
 * @param {{ resolveProjectId: (label: string, subLabel: string|null, color?: string) => string,
 *           current?: object|null, now?: () => string }} context
 */
export function desktopTaskChanges(fields, { resolveProjectId, current = null, now = () => new Date().toISOString() }) {
    const out = {};
    if ("title" in fields) out.title = String(fields.title ?? "").trim();
    if ("description" in fields) out.description = String(fields.description ?? "");
    if ("date" in fields) {
        out.dueDate = fields.date ? String(fields.date) : null;
        if (!out.dueDate) out.dueTime = null;
    }
    if ("time" in fields && out.dueTime === undefined) {
        out.dueTime = !fields.time || fields.time === NO_TIME ? null : String(fields.time);
    }
    if ("reminder" in fields) out.reminder = fields.reminder || null;
    if ("estimatedDuration" in fields) {
        // O Gemini devolve 0 quando o comando não fala de duração (o schema
        // não aceita null); 0 minutos é o mesmo que "sem duração".
        const minutes = Number(fields.estimatedDuration);
        out.estimatedDuration = fields.estimatedDuration === null || fields.estimatedDuration === "" || !(minutes > 0)
            ? null
            : minutes;
    }
    if ("tags" in fields) out.tags = Array.isArray(fields.tags) ? fields.tags : [];
    if ("subtasks" in fields) out.subtasks = Array.isArray(fields.subtasks) ? fields.subtasks : [];
    if ("assignee" in fields) out.assignee = fields.assignee ?? null;
    if ("priority" in fields) out.priority = TO_CANONICAL_PRIORITY[fields.priority] ?? "medium";
    // O desktop sempre manda projeto e subprojeto juntos.
    if ("project" in fields) {
        out.projectId = resolveProjectId(
            String(fields.project ?? ""),
            fields.subProject ? String(fields.subProject) : null,
            fields.projectColor,
        );
    }
    if ("completed" in fields) {
        const done = !!fields.completed;
        const wasDone = current?.status === "done";
        if (done && !wasDone) {
            out.status = "done";
            out.completedAt = fields.completedAt || now();
        } else if (!done && wasDone) {
            out.status = "todo";
            out.completedAt = null;
        } else if (!current) {
            out.status = done ? "done" : "todo";
            out.completedAt = done ? fields.completedAt || now() : null;
        }
    }
    return out;
}

// ── Anotações ────────────────────────────────────────────────

export function noteToDesktop(record) {
    return {
        id: record.id,
        title: record.title ?? "Sem título",
        content: record.content ?? "",
        color: record.color ?? "gray",
        completed: !!record.completed,
        parentId: record.parentId ?? null,
        createdAt: record.createdAt ?? record.updatedAt,
        updatedAt: record.updatedAt,
    };
}

// ── Rotinas ──────────────────────────────────────────────────

export function routineToDesktop(record) {
    return {
        id: record.id,
        label: record.label ?? "Rotina",
        time: record.time ?? "08:00",
        icon: record.icon ?? "CheckCircle2",
        color: record.color ?? "text-indigo-400",
        streak: record.streak ?? 0,
        aiAdjusted: !!record.aiAdjusted,
        completedDates: Array.isArray(record.completedDates) ? record.completedDates : [],
        createdAt: record.createdAt ?? record.updatedAt,
    };
}

/** Mesma regra dos dois apps: desmarca se já estava; senão entra no topo, guardando 14 dias. */
export function toggleRoutineDate(dates, date) {
    const list = Array.isArray(dates) ? dates : [];
    return list.includes(date) ? list.filter((day) => day !== date) : [date, ...list].slice(0, 14);
}

// ── Kanban ───────────────────────────────────────────────────

export const DEFAULT_COLUMN_TITLES = ["A fazer", "Fazendo", "Feito"];

/** Posição entre dois vizinhos; sem um deles, um passo além do outro. */
export function positionBetween(before, after) {
    if (before == null && after == null) return 1;
    if (before == null) return after - 1;
    if (after == null) return before + 1;
    return (before + after) / 2;
}

/**
 * O quadro de uma pasta no formato da KanbanView do desktop
 * ({ columnOrder, columns: {id: {cardIds}}, cards }). Cartão de coluna que
 * não existe fica oculto.
 */
export function boardToDesktop(boardId, columnRecords, cardRecords) {
    const columns = columnRecords.filter((c) => c.boardId === boardId).sort(byPosition);
    const columnIds = new Set(columns.map((c) => c.id));
    const cards = cardRecords.filter((card) => card.boardId === boardId && columnIds.has(card.columnId)).sort(byPosition);
    return {
        columnOrder: columns.map((c) => c.id),
        columns: Object.fromEntries(
            columns.map((column) => [
                column.id,
                {
                    id: column.id,
                    title: column.title ?? "",
                    cardIds: cards.filter((card) => card.columnId === column.id).map((card) => card.id),
                },
            ]),
        ),
        cards: Object.fromEntries(
            cards.map((card) => [
                card.id,
                {
                    id: card.id,
                    title: card.title ?? "",
                    description: card.description ?? "",
                    color: card.color ?? null,
                    createdAt: card.createdAt,
                },
            ]),
        ),
    };
}
