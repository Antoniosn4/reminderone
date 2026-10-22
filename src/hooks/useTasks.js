// =============================================================
//  useTasks.js
//  Custom Hook — gerenciamento de estado e lógica das tarefas.
//  CRUD sobre o armazenamento de registros (sincronizado com o
//  celular) e enriquecimento via Gemini com fallback obrigatório.
//
//  As telas continuam recebendo o formato do desktop (rótulo de
//  projeto, "Sem horário", prioridade "normal"); a conversão para o
//  protocolo fica em data/mappers.js.
// =============================================================

import { useState, useCallback, useMemo } from "react";
import toast from "react-hot-toast";
import { callGemini } from "../services/geminiService";
import { logger } from "../utils/logger";
import { useCollection, useData } from "../data/DataContext";
import { desktopTaskChanges, localDateISO, taskToDesktop } from "../data/mappers";
import { ensureProjectId } from "./useProjects";
import {
    createTask,
    DEFAULT_PROJECT,
    PRIORITY_LEVELS,
} from "../constants/taskSchema";

// ----- Schemas de resposta Gemini -----

const TASK_PARSE_SCHEMA = {
    type: "OBJECT",
    properties: {
        title: { type: "STRING", description: "O título principal da tarefa, limpo e conciso." },
        description: { type: "STRING", description: "Uma descrição breve da tarefa se possível extrair do texto. Se não houver detalhes além do título, retorne string vazia." },
        date: { type: "STRING", description: "A data da tarefa no formato ISO YYYY-MM-DD. Se o usuário diz 'hoje', use a data de hoje. Se diz 'amanhã', calcule o dia seguinte. Se não mencionar data, use a data de hoje." },
        time: { type: "STRING", description: "O horário da tarefa no formato HH:MM (24h). Se não houver horário, use 'Sem horário'." },
        project: { type: "STRING", description: "O projeto lógico para essa tarefa, escolhido da lista fornecida." },
        projectColor: {
            type: "STRING",
            description: "Uma cor hexadecimal (ex: '#3b82f6', '#10b981', '#8b5cf6').",
        },
        priority: {
            type: "STRING",
            description: "Nível de prioridade: 'urgent' se contém palavras como 'urgente'/'emergência', 'high' se 'importante'/'prioridade alta', 'low' se 'baixa prioridade'/'quando puder', 'normal' para o resto.",
        },
        tags: {
            type: "ARRAY",
            items: { type: "STRING" },
            description: "Tags/etiquetas relevantes extraídas do texto (ex: 'reunião', 'design', 'bug'). Se nenhuma tag fizer sentido, retorne array vazio.",
        },
        estimatedDuration: {
            type: "NUMBER",
            description: "Duração estimada em minutos, se mencionada (ex: 'reunião de 30 min' → 30). Se não mencionada, retorne null.",
        },
    },
    required: ["title", "date", "time", "project", "projectColor", "priority"],
};

const SUBTASK_SCHEMA = {
    type: "ARRAY",
    items: {
        type: "OBJECT",
        properties: {
            title: { type: "STRING", description: "Título descritivo da subtarefa." },
            completed: { type: "BOOLEAN", description: "Sempre enviar como false." },
        },
    },
};

// ----- Helpers puros -----

function buildFallbackTask(cleanText) {
    return {
        title: cleanText,
        description: "",
        date: localDateISO(),
        time: "Sem horário",
        project: DEFAULT_PROJECT.label,
        projectColor: DEFAULT_PROJECT.color,
        priority: PRIORITY_LEVELS.NORMAL,
        tags: [],
        estimatedDuration: null,
    };
}

function buildPrompt(cleanText, projectNames) {
    const today = localDateISO();
    const dayOfWeek = new Date().toLocaleDateString("pt-BR", { weekday: "long" });
    const projectList = projectNames.length > 0 ? projectNames.join(", ") : DEFAULT_PROJECT.label;

    return `Você é um assistente de produtividade. Analise a tarefa abaixo e extraia informações estruturadas.

Data de hoje: ${today} (${dayOfWeek}).
Projetos disponíveis: ${projectList}.

Regras:
- "title": crie um título limpo e conciso para a tarefa.
- "description": se houver contexto adicional além do título, extraia uma breve descrição. Caso contrário, retorne "".
- "date": calcule a data real no formato YYYY-MM-DD. "Hoje" = ${today}. "Amanhã" = dia seguinte. "Segunda" = próxima segunda-feira. Se não mencionar data, use ${today}.
- "time": extraia o horário no formato HH:MM. Ex: "às 10 horas" = "10:00". Se não houver horário, use "Sem horário".
- "project": associe ao projeto mais adequado da lista.
- "projectColor": escolha uma cor hex harmoniosa.
- "priority": classifique a prioridade (urgent, high, normal, low).
- "tags": extraia tags relevantes do contexto (ex: "reunião", "design", "bug"). Array vazio se nenhuma.
- "estimatedDuration": se mencionada uma duração (ex: "30 min", "1 hora"), retorne em minutos. Caso contrário null.

Entrada do usuário: "${cleanText}"`;
}

// ----- Hook -----

export function useTasks() {
    const { store } = useData();
    const taskRecords = useCollection("task");
    const projectRecords = useCollection("project");
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // As mais novas primeiro, como a lista do desktop sempre mostrou.
    const tasks = useMemo(() => {
        const projectsById = new Map(projectRecords.map((project) => [project.id, project]));
        return taskRecords
            .map((record) => taskToDesktop(record, projectsById))
            .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    }, [taskRecords, projectRecords]);

    const resolveProjectId = useCallback(
        (label, subLabel, color) => ensureProjectId(store, label, subLabel, color),
        [store],
    );

    /** Grava uma tarefa nova (formato do desktop) como registro. */
    const insertTask = useCallback((desktopTask, origin = "manual") => {
        let created = null;
        store.batch(() => {
            const fields = desktopTaskChanges(desktopTask, { resolveProjectId, current: null });
            store.write("task", String(desktopTask.id), {
                ...fields,
                origin,
                createdAt: desktopTask.createdAt || new Date().toISOString(),
            });
            created = desktopTask;
        });
        return created;
    }, [store, resolveProjectId]);

    // ── Operações ──────────────────────────────────────────────────────────

    const updateTask = useCallback((id, updates) => {
        const current = store.get("task", id);
        if (!current) return;
        store.batch(() => {
            store.write("task", id, desktopTaskChanges(updates, { resolveProjectId, current }));
        });
    }, [store, resolveProjectId]);

    const toggleTask = useCallback((id) => {
        const current = store.get("task", id);
        if (!current) return;
        const done = current.status !== "done";
        store.write("task", id, {
            status: done ? "done" : "todo",
            completedAt: done ? new Date().toISOString() : null,
        });
    }, [store]);

    const deleteTask = useCallback((id) => {
        store.remove("task", id);
    }, [store]);

    /**
     * Interpreta o texto via Gemini e adiciona a nova tarefa.
     * Garante que a tarefa nunca é perdida — fallback obrigatório
     * se a IA falhar.
     */
    const addTaskFromText = useCallback(
        async (rawText, assignee = null, projectNames = []) => {
            if (!rawText.trim()) return;

            setIsAnalyzing(true);
            const cleanText = rawText.replace(/@\w+/g, "").trim();

            let taskData;
            try {
                const parsedData = await callGemini(
                    buildPrompt(cleanText, projectNames),
                    TASK_PARSE_SCHEMA,
                );

                if (parsedData !== null) {
                    taskData = parsedData;
                } else {
                    toast.error("Sem IA: tarefa salva com dados básicos. Verifique o servidor.", {
                        duration: 4000,
                    });
                    taskData = buildFallbackTask(cleanText);
                }
            } catch (err) {
                logger.error("[useTasks] Erro inesperado:", err);
                toast.error("Erro inesperado. Tarefa salva com dados básicos.");
                taskData = buildFallbackTask(cleanText);
            } finally {
                setIsAnalyzing(false);
            }

            insertTask(createTask({ ...taskData, assignee }));
        },
        [insertTask],
    );

    /**
     * Cria uma tarefa manualmente com dados fornecidos pelo formulário.
     * Usado pelo modal "Criar Tarefa".
     *
     * @param {Partial<Task>} taskFields — campos da tarefa
     * @returns {Promise<Task>} — a tarefa criada
     */
    const addTaskManual = useCallback(
        async (taskFields) => insertTask(createTask(taskFields)),
        [insertTask],
    );

    const generateSubtasks = useCallback(async (taskId, taskTitle) => {
        const prompt = `Crie um plano com 3 passos essenciais curtos para: "${taskTitle}".`;
        const subtasks = await callGemini(prompt, SUBTASK_SCHEMA);
        if (subtasks) updateTask(taskId, { subtasks });
        return subtasks;
    }, [updateTask]);

    const toggleSubtask = useCallback((taskId, subtaskIndex) => {
        const current = store.get("task", taskId);
        if (!current) return;
        const subtasks = (Array.isArray(current.subtasks) ? current.subtasks : []).map((sub, i) =>
            i === subtaskIndex ? { ...sub, completed: !sub.completed } : sub,
        );
        store.write("task", taskId, { subtasks });
    }, [store]);

    return {
        tasks,
        isAnalyzing,
        addTaskFromText,
        addTaskManual,
        toggleTask,
        updateTask,
        deleteTask,
        generateSubtasks,
        toggleSubtask,
    };
}
