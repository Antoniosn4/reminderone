// =============================================================
//  useProjects.js
//  Custom Hook — Gerenciamento CRUD de projetos com sub-projetos.
//  Persistência via localStorage criptografado (AES-GCM).
// =============================================================

import { useCallback } from "react";
import { usePersistedState } from "./usePersistedState";
import { generateId } from "../utils/id";

const STORAGE_KEY = "reminder-custom-projects-encrypted";

const DEFAULT_PROJECTS = [
    {
        id: "frontend",
        label: "Frontend",
        color: "#3b82f6",
        subProjects: [
            { id: "frontend_ds", label: "Design System" },
            { id: "frontend_comp", label: "Componentes" },
        ],
    },
    {
        id: "reunioes",
        label: "Reuniões",
        color: "#8b5cf6",
        subProjects: [{ id: "reunioes_daily", label: "Daily" }],
    },
    {
        id: "marketing",
        label: "Marketing",
        color: "#ec4899",
        subProjects: [{ id: "marketing_ads", label: "Ads" }],
    },
    {
        id: "infra",
        label: "Infra",
        color: "#f97316",
        subProjects: [],
    },
];

const PROJECT_COLORS = [
    "#3b82f6", "#8b5cf6", "#ec4899", "#f97316",
    "#10b981", "#eab308", "#ef4444", "#06b6d4",
];

function slugify(label) {
    return label.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

function makeProjectId(label) {
    return `${slugify(label) || "proj"}_${generateId()}`;
}

function makeSubProjectId(parentId, label) {
    return `${parentId}__${slugify(label) || "sub"}_${generateId()}`;
}

function hasDuplicateLabel(items, label, ignoreId = null) {
    const target = label.toLowerCase();
    return items.some(
        (item) => item.id !== ignoreId && item.label.toLowerCase() === target,
    );
}

export function useProjects() {
    const [projects, setProjects] = usePersistedState(STORAGE_KEY, DEFAULT_PROJECTS);

    const addProject = useCallback((proj) => {
        const trimmed = proj?.label?.trim();
        if (!trimmed) return;
        setProjects((prev) => {
            if (hasDuplicateLabel(prev, trimmed)) return prev;
            const color = proj.color || PROJECT_COLORS[prev.length % PROJECT_COLORS.length];
            return [
                ...prev,
                {
                    id: makeProjectId(trimmed),
                    label: trimmed,
                    color,
                    subProjects: [],
                },
            ];
        });
    }, [setProjects]);

    const updateProject = useCallback((id, updates) => {
        setProjects((prev) =>
            prev.map((p) => (p.id === id ? { ...p, ...updates } : p)),
        );
    }, [setProjects]);

    const removeProject = useCallback((id) => {
        setProjects((prev) => prev.filter((p) => p.id !== id));
    }, [setProjects]);

    const addSubProject = useCallback((projectId, label) => {
        const trimmed = label?.trim();
        if (!trimmed) return;
        setProjects((prev) =>
            prev.map((project) => {
                if (project.id !== projectId) return project;
                const subs = project.subProjects ?? [];
                if (hasDuplicateLabel(subs, trimmed)) return project;
                return {
                    ...project,
                    subProjects: [
                        ...subs,
                        { id: makeSubProjectId(project.id, trimmed), label: trimmed },
                    ],
                };
            }),
        );
    }, [setProjects]);

    const updateSubProject = useCallback((projectId, subId, updates) => {
        const trimmed = updates?.label?.trim();
        if (!trimmed) return;
        setProjects((prev) =>
            prev.map((project) => {
                if (project.id !== projectId) return project;
                const subs = project.subProjects ?? [];
                if (hasDuplicateLabel(subs, trimmed, subId)) return project;
                return {
                    ...project,
                    subProjects: subs.map((sub) =>
                        sub.id === subId ? { ...sub, ...updates, label: trimmed } : sub,
                    ),
                };
            }),
        );
    }, [setProjects]);

    const removeSubProject = useCallback((projectId, subId) => {
        setProjects((prev) =>
            prev.map((project) =>
                project.id === projectId
                    ? {
                          ...project,
                          subProjects: (project.subProjects ?? []).filter(
                              (sub) => sub.id !== subId,
                          ),
                      }
                    : project,
            ),
        );
    }, [setProjects]);

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
