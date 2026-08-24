// =============================================================
//  useTasks.js
//  Custom Hook — gerenciamento de estado e lógica das tarefas.
//  CRUD com persistência incremental no IndexedDB cifrado e
//  enriquecimento via Gemini com fallback obrigatório.
// =============================================================

import { useState, useEffect, useRef, useCallback } from "react";
import toast from "react-hot-toast";
import { callGemini } from "../services/geminiService";
import {
    getAllTasks,
    putTask,
    deleteTaskById,
} from "../services/secureStorage";
import { syncTask, deleteCalendarEvent } from "../services/calendarService";
import { generateId } from "../utils/id";
import { logger } from "../utils/logger";
import { useVault } from "../components/vault/VaultContext";

// ----- Schemas de resposta Gemini -----

const TASK_PARSE_SCHEMA = {
    type: "OBJECT",
    properties: {
        title: { type: "STRING", description: "O título principal da tarefa, limpo e conciso." },
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

const FALLBACK_PROJECT_LABEL = "Entrada";
const FALLBACK_PROJECT_COLOR = "#6b7280";

// ----- Helpers puros -----

function buildFallbackTask(cleanText) {
    return {
        title: cleanText,
        date: new Date().toISOString().split("T")[0],
        time: "Sem horário",
        project: FALLBACK_PROJECT_LABEL,
        projectColor: FALLBACK_PROJECT_COLOR,
        priority: "normal",
    };
}

function buildPrompt(cleanText, projectNames) {
    const today = new Date().toISOString().split("T")[0];
    const dayOfWeek = new Date().toLocaleDateString("pt-BR", { weekday: "long" });
    const projectList = projectNames.length > 0 ? projectNames.join(", ") : FALLBACK_PROJECT_LABEL;

    return `Você é um assistente de produtividade. Analise a tarefa abaixo e extraia informações estruturadas.

Data de hoje: ${today} (${dayOfWeek}).
Projetos disponíveis: ${projectList}.

Regras:
- "title": crie um título limpo e conciso para a tarefa.
- "date": calcule a data real no formato YYYY-MM-DD. "Hoje" = ${today}. "Amanhã" = dia seguinte. "Segunda" = próxima segunda-feira. Se não mencionar data, use ${today}.
- "time": extraia o horário no formato HH:MM. Ex: "às 10 horas" = "10:00". Se não houver horário, use "Sem horário".
- "project": associe ao projeto mais adequado da lista.
- "projectColor": escolha uma cor hex harmoniosa.

Entrada do usuário: "${cleanText}"`;
}

// ----- Hook -----

export function useTasks() {
    const { key } = useVault();
    const [tasks, setTasks] = useState([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const tasksRef = useRef(tasks);

    useEffect(() => { tasksRef.current = tasks; }, [tasks]);

    // Hidrata a partir do IndexedDB cifrado quando a chave fica disponível.
    useEffect(() => {
        if (!key) {
            setTasks([]);
            return;
        }
        let cancelled = false;
        getAllTasks(key).then((loaded) => {
            if (!cancelled) setTasks(loaded);
        });
        return () => { cancelled = true; };
    }, [key]);

    // ── Operações ──────────────────────────────────────────────────────────

    const updateTask = useCallback((id, updates) => {
        if (!key) return;
        setTasks((prev) => {
            const next = prev.map((t) => (t.id === id ? { ...t, ...updates } : t));
            const updated = next.find((t) => t.id === id);
            if (updated) putTask(key, updated);
            return next;
        });
    }, [key]);

    const toggleTask = useCallback((id) => {
        if (!key) return;
        setTasks((prev) => {
            const next = prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t));
            const updated = next.find((t) => t.id === id);
            if (updated) putTask(key, updated);
            return next;
        });
    }, [key]);

    const deleteTask = useCallback((id) => {
        const target = tasksRef.current.find((t) => t.id === id);
        if (target?.gcalEventId) {
            deleteCalendarEvent(target.gcalEventId);
        }
        deleteTaskById(id);
        setTasks((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const updateTaskAndSync = useCallback((id, updates) => {
        if (!key) return;
        setTasks((prev) => {
            const next = prev.map((t) => (t.id === id ? { ...t, ...updates } : t));
            const updated = next.find((t) => t.id === id);
            if (!updated) return next;

            putTask(key, updated);
            const requiresGcalSync = "title" in updates || "time" in updates || "date" in updates;
            if (requiresGcalSync) {
                syncTask(updated).then((eventId) => {
                    if (!eventId || eventId === updated.gcalEventId) return;
                    updateTask(id, { gcalEventId: eventId, syncStatus: "synced" });
                });
            }
            return next;
        });
    }, [key, updateTask]);

    /**
     * Interpreta o texto via Gemini e adiciona a nova tarefa.
     * Garante que a tarefa nunca é perdida — fallback obrigatório
     * se a IA falhar.
     */
    const addTaskFromText = useCallback(
        async (rawText, assignee = null, projectNames = []) => {
            if (!rawText.trim() || !key) return;

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

            const newTask = {
                id: generateId(),
                ...taskData,
                assignee,
                syncStatus: "pending",
                completed: false,
                subtasks: [],
                gcalEventId: null,
            };

            await putTask(key, newTask);
            setTasks((prev) => [newTask, ...prev]);

        syncTask(newTask).then((eventId) => {
            updateTask(newTask.id, {
                syncStatus: eventId ? "synced" : "offline",
                gcalEventId: eventId ?? null,
            });
        });
        },
        [key, updateTask],
    );

    const generateSubtasks = useCallback(async (taskId, taskTitle) => {
        const prompt = `Crie um plano com 3 passos essenciais curtos para: "${taskTitle}".`;
        const subtasks = await callGemini(prompt, SUBTASK_SCHEMA);
        if (subtasks) updateTask(taskId, { subtasks });
        return subtasks;
    }, [updateTask]);

    /**
     * Re-sincroniza com o Google Calendar todas as tarefas que estão `offline`
     * ou `pending` (futuras + sem horário definido continuam pulando o sync).
     * Retorna { synced, failed } para feedback no UI.
     */
    const resyncWithCalendar = useCallback(async () => {
        if (!key) return { synced: 0, failed: 0 };

        const pending = tasksRef.current.filter(
            (t) => !t.completed && (t.syncStatus === "offline" || t.syncStatus === "pending"),
        );

        let synced = 0;
        let failed = 0;
        for (const task of pending) {
            try {
                const eventId = await syncTask(task);
                if (eventId) {
                    updateTask(task.id, {
                        gcalEventId: eventId,
                        syncStatus: "synced",
                    });
                    synced += 1;
                } else {
                    failed += 1;
                }
            } catch (err) {
                logger.error("[useTasks.resync] Falha ao sincronizar:", err);
                failed += 1;
            }
        }
        return { synced, failed };
    }, [key, updateTask]);

    const toggleSubtask = useCallback((taskId, subtaskIndex) => {
        if (!key) return;
        setTasks((prev) => {
            const next = prev.map((task) => {
                if (task.id !== taskId) return task;
                const updatedSubtasks = task.subtasks.map((sub, i) =>
                    i === subtaskIndex ? { ...sub, completed: !sub.completed } : sub,
                );
                return { ...task, subtasks: updatedSubtasks };
            });
            const updated = next.find((t) => t.id === taskId);
            if (updated) putTask(key, updated);
            return next;
        });
    }, [key]);

    return {
        tasks,
        isAnalyzing,
        addTaskFromText,
        toggleTask,
        updateTask: updateTaskAndSync,
        deleteTask,
        generateSubtasks,
        toggleSubtask,
        resyncWithCalendar,
    };
}
