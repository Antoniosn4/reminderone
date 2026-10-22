// =============================================================
//  useProjects.js
//  Custom Hook — CRUD de projetos com sub-projetos sobre o
//  armazenamento de registros (sincronizado com o celular).
//  Subprojeto = projeto com `parentId`. Excluir manda as tarefas
//  do projeto (e dos subprojetos) para a Entrada, como no mobile.
// =============================================================

import { useCallback, useMemo } from "react";
import { useCollection, useData } from "../data/DataContext";
import {
    IDEAS_PROJECT_ID,
    IDEAS_PROJECT_LABEL,
    INBOX_ID,
    INBOX_LABEL,
    projectsToDesktop,
} from "../data/mappers";
import { generateId } from "../utils/id";

const PROJECT_COLORS = [
    "#3b82f6", "#8b5cf6", "#ec4899", "#f97316",
    "#10b981", "#eab308", "#ef4444", "#06b6d4",
];

const lower = (text) => String(text ?? "").trim().toLocaleLowerCase("pt-BR");

function slugify(label) {
    return lower(label).replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

function nextPosition(records) {
    return records.reduce((max, record) => Math.max(max, record.position ?? 0), 0) + 1;
}

/**
 * O id do projeto (ou subprojeto) com esses rótulos, criando o que faltar.
 * É por aqui que a IA e os formulários, que falam em rótulos, chegam aos ids.
 */
export function ensureProjectId(store, label, subLabel = null, color = null) {
    const name = String(label ?? "").trim();
    if (!name || lower(name) === lower(INBOX_LABEL)) return INBOX_ID;
    const records = store.list("project");
    let top = records.find((p) => !p.parentId && lower(p.name) === lower(name));
    if (!top) {
        const id = lower(name) === lower(IDEAS_PROJECT_LABEL) ? IDEAS_PROJECT_ID : `${slugify(name) || "proj"}_${generateId()}`;
        top = store.write("project", id, {
            name,
            color: color || PROJECT_COLORS[records.length % PROJECT_COLORS.length],
            parentId: null,
            position: nextPosition(records),
            createdAt: new Date().toISOString(),
        });
    }
    const subName = String(subLabel ?? "").trim();
    if (!subName) return top.id;
    const siblings = records.filter((p) => p.parentId === top.id);
    const sub = siblings.find((p) => lower(p.name) === lower(subName));
    if (sub) return sub.id;
    return store.write("project", `${top.id}__${slugify(subName) || "sub"}_${generateId()}`, {
        name: subName,
        color: null,
        parentId: top.id,
        position: nextPosition(siblings),
        createdAt: new Date().toISOString(),
    }).id;
}

/** Exclui projetos e manda as tarefas deles para a Entrada (dentro de um batch). */
function removeProjects(store, ids) {
    const removed = new Set(ids);
    for (const id of ids) store.remove("project", id);
    for (const task of store.list("task")) {
        if (removed.has(task.projectId)) store.write("task", task.id, { projectId: INBOX_ID });
    }
}

export function useProjects() {
    const { store } = useData();
    const records = useCollection("project");
    const projects = useMemo(() => projectsToDesktop(records), [records]);

    const addProject = useCallback((proj) => {
        const trimmed = proj?.label?.trim();
        if (!trimmed) return;
        const roots = store.list("project").filter((p) => !p.parentId);
        if (roots.some((p) => lower(p.name) === lower(trimmed)) || lower(trimmed) === lower(INBOX_LABEL)) return;
        store.write("project", `${slugify(trimmed) || "proj"}_${generateId()}`, {
            name: trimmed,
            color: proj.color || PROJECT_COLORS[roots.length % PROJECT_COLORS.length],
            parentId: null,
            position: nextPosition(roots),
            createdAt: new Date().toISOString(),
        });
    }, [store]);

    const updateProject = useCallback((id, updates) => {
        if (!store.get("project", id)) return;
        const changes = {};
        if (updates.label !== undefined) {
            const trimmed = String(updates.label).trim();
            if (!trimmed) return;
            changes.name = trimmed;
        }
        if (updates.color !== undefined) changes.color = updates.color;
        store.write("project", id, changes);
    }, [store]);

    const removeProject = useCallback((id) => {
        store.batch(() => {
            const children = store.list("project").filter((p) => p.parentId === id).map((p) => p.id);
            removeProjects(store, [id, ...children]);
        });
    }, [store]);

    const addSubProject = useCallback((projectId, label) => {
        const trimmed = label?.trim();
        if (!trimmed || !store.get("project", projectId)) return;
        const siblings = store.list("project").filter((p) => p.parentId === projectId);
        if (siblings.some((p) => lower(p.name) === lower(trimmed))) return;
        store.write("project", `${projectId}__${slugify(trimmed) || "sub"}_${generateId()}`, {
            name: trimmed,
            color: null,
            parentId: projectId,
            position: nextPosition(siblings),
            createdAt: new Date().toISOString(),
        });
    }, [store]);

    const updateSubProject = useCallback((projectId, subId, updates) => {
        const trimmed = updates?.label?.trim();
        if (!trimmed) return;
        const siblings = store.list("project").filter((p) => p.parentId === projectId && p.id !== subId);
        if (siblings.some((p) => lower(p.name) === lower(trimmed))) return;
        store.write("project", subId, { name: trimmed });
    }, [store]);

    const removeSubProject = useCallback((projectId, subId) => {
        store.batch(() => removeProjects(store, [subId]));
    }, [store]);

    return {
        projects,
        addProject,
        updateProject,
        removeProject,
        addSubProject,
        updateSubProject,
        removeSubProject,
    };
}
