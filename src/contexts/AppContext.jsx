// =============================================================
//  AppContext.jsx
//  Centraliza TODOS os hooks de domínio e estado da UI em um
//  único context provider. Elimina prop-drilling e reduz App.jsx
//  a um componente puramente de composição.
//
//  Consumido via:  const ctx = useAppContext()
// =============================================================

import {
    createContext, useContext, useState, useRef, useCallback, useEffect,
} from "react";
import toast from "react-hot-toast";

// Domain hooks
import { useTasks } from "../hooks/useTasks";
import { useNavigation } from "../hooks/useNavigation";
import { useVoiceRecording } from "../hooks/useVoiceRecording";
import { useMention, extractMentionedMember } from "../hooks/useMention";
import { useProjects } from "../hooks/useProjects";
// useTeams removed — Teams feature not in v0.1.0
import { useRoutines } from "../hooks/useRoutines";
import { useNotes } from "../hooks/useNotes";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { useVault } from "../components/vault/VaultContext";
import { useRoutineNotifications } from "../hooks/useRoutineNotifications";
import { useTheme } from "../hooks/useTheme";
import { useCollection, useData } from "../data/DataContext";
import { localDateISO } from "../data/mappers";

import { loadGeminiKey } from "../services/geminiKeyStorage";
import { setGeminiApiKey } from "../services/geminiService";

const AppContext = createContext(null);

/** @returns {ReturnType<typeof useAppProvider>} */
export function useAppContext() {
    const ctx = useContext(AppContext);
    if (!ctx) throw new Error("useAppContext must be used within <AppProvider>");
    return ctx;
}

// ── Helpers ──

function getFormattedDate() {
    return new Date().toLocaleDateString("pt-BR", {
        weekday: "short", day: "numeric", month: "short",
    }).replace(/\.$/, "");
}

function filterTasksByView(tasks, filter, projects) {
    switch (filter) {
        case "hoje": return tasks.filter((t) => t.date === localDateISO());
        case "entrada": return tasks.filter((t) => t.project === "Entrada");
        case "ideias_produto": return tasks.filter((t) => t.project === "Ideias de Produto");
        default: {
            for (const proj of projects) {
                if (proj.id === filter) return tasks.filter((t) => t.project === proj.label);
                for (const sub of (proj.subProjects || [])) {
                    if (sub.id === filter) return tasks.filter((t) => t.subProject === sub.label);
                }
            }
            return tasks;
        }
    }
}

// ── Provider component ──

function useAppProvider() {
    // ── Theme ──
    const themeCtx = useTheme();

    // ── Vault key + Gemini key ──
    const { key: vaultKey, lock, profile, updateProfile } = useVault();
    useEffect(() => {
        if (!vaultKey) return;
        loadGeminiKey(vaultKey).then((apiKey) => {
            if (apiKey) setGeminiApiKey(apiKey);
        });
    }, [vaultKey]);

    // ── Perfil: o mesmo nos dois apps (registro "me") ──
    const { store } = useData();
    const profileRecords = useCollection("profile");
    useEffect(() => {
        const synced = profileRecords.find((record) => record.id === "me");
        if (!synced) return;
        if (synced.name !== (profile?.name ?? "") || synced.email !== (profile?.email ?? "")) {
            updateProfile({ name: synced.name ?? "", email: synced.email ?? "" });
        }
    }, [profileRecords, profile, updateProfile]);

    const saveProfile = useCallback((next) => {
        updateProfile(next);
        store.write("profile", "me", { name: next.name ?? "", email: next.email ?? "" });
    }, [store, updateProfile]);

    // ── Domain hooks ──
    const {
        tasks, isAnalyzing, addTaskFromText, addTaskManual, toggleTask,
        updateTask, deleteTask, generateSubtasks, toggleSubtask,
    } = useTasks();

    const {
        projects, addProject, updateProject, removeProject,
        addSubProject, updateSubProject, removeSubProject,
    } = useProjects();

    const teams = []; // Teams feature removed in v0.1.0
    const mentionableMembers = [];

    const { routines, addRoutine, updateRoutine, deleteRoutine, toggleRoutineToday } = useRoutines();
    const { notes, addNote, updateNote, deleteNote, toggleNoteCompletion } = useNotes();
    const { activeView, navigate, viewTitle, viewType, viewFilter } = useNavigation("hoje", projects, teams, routines);

    // ── Input + voice ──
    const [inputValue, setInputValue] = useState("");
    const inputRef = useRef(null);

    const addTaskRef = useRef(null);
    const handleTranscribed = useCallback((text) => {
        if (addTaskRef.current) addTaskRef.current(text);
    }, []);

    const {
        isRecording, isTranscribing, elapsedTime, toggleRecording, cancelRecording, mediaStream,
    } = useVoiceRecording(setInputValue, handleTranscribed);

    const { isMenuOpen, handleInputChange, selectMember, closeMenu } = useMention(inputValue, setInputValue, inputRef);

    // ── UI state: modais e panels ──
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);

    // CRUD modal state
    const [editingTask, setEditingTask] = useState(null);
    const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
    const [editingProject, setEditingProject] = useState(null);
    // Teams modal state removed — v0.1.0
    const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
    const [isNewRoutineOpen, setIsNewRoutineOpen] = useState(false);
    const [editingRoutine, setEditingRoutine] = useState(null);
    const [selectedCalendarDate, setSelectedCalendarDate] = useState(null);
    const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
    const [editingNote, setEditingNote] = useState(null);

    // ── Keyboard shortcuts ──
    useKeyboardShortcuts([
        { combo: "mod+n", handler: () => setIsQuickAddOpen(true) },
        { combo: "mod+k", handler: () => setIsSearchOpen(true) },
        { combo: "mod+l", handler: () => lock() },
        { combo: "mod+,", handler: () => navigate("settings") },
        { combo: "mod+1", handler: () => navigate("hoje") },
        { combo: "mod+2", handler: () => navigate("calendario") },
        { combo: "mod+3", handler: () => navigate("historico") },
    ]);

    // ── Routine notifications ──
    useRoutineNotifications(routines);

    // ── Project names builder ──
    const buildProjectNames = useCallback(() => {
        const dynamicLabels = projects.map((p) => p.label);
        return [...new Set(["Entrada", ...dynamicLabels, "Ideias de Produto"])];
    }, [projects]);

    // ── Submit handler ──
    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();
        if (!inputValue.trim()) return;
        const assignee = extractMentionedMember(inputValue, mentionableMembers);
        await addTaskFromText(inputValue, assignee, buildProjectNames());
        setInputValue("");
        closeMenu();
        toast.success("✅ Tarefa criada", { duration: 2000 });
    }, [inputValue, addTaskFromText, closeMenu, buildProjectNames, mentionableMembers]);

    // Voice auto-submit ref
    addTaskRef.current = async (text) => {
        if (!text?.trim()) return;
        const assignee = extractMentionedMember(text, mentionableMembers);
        await addTaskFromText(text, assignee, buildProjectNames());
        setInputValue("");
        toast.success("✅ Auto-salva via Voz", { duration: 3000 });
    };

    // ── CRUD handlers ──
    const handleTaskCreate = useCallback(async (taskFields) => {
        await addTaskManual(taskFields);
        setIsCreateTaskOpen(false);
        try {
            await store.flushed();
            toast.success("Tarefa criada e salva neste dispositivo", { duration: 2000 });
        } catch {
            toast.error("A tarefa está pendente de gravação. Use Tentar novamente no aviso.");
        }
    }, [addTaskManual, store]);

    const handleTaskEditSave = useCallback(async (id, updates) => {
        updateTask(id, updates);
        try {
            await store.flushed();
            setEditingTask(null);
            toast.success("Tarefa atualizada", { duration: 2000 });
        } catch {
            toast.error("A alteração ainda não foi salva. Use Tentar novamente no aviso.");
        }
    }, [updateTask, store]);

    const handleTaskEditDelete = useCallback(async (id) => {
        deleteTask(id);
        try {
            await store.flushed();
            setEditingTask(null);
            toast.success("Tarefa excluída", { duration: 2000 });
        } catch {
            toast.error("A exclusão ainda não foi salva. Use Tentar novamente no aviso.");
        }
    }, [deleteTask, store]);

    const handleNewProject = useCallback((proj) => {
        addProject(proj); setIsNewProjectOpen(false);
        toast.success(`Projeto "${proj.label}" criado`, { duration: 2000 });
    }, [addProject]);

    const handleEditProjectSave = useCallback((id, updates) => {
        updateProject(id, updates); setEditingProject(null);
        toast.success("Projeto atualizado", { duration: 2000 });
    }, [updateProject]);

    const handleDeleteProject = useCallback((id) => {
        removeProject(id); setEditingProject(null); navigate("hoje");
        toast.success("Projeto excluído", { duration: 2000 });
    }, [removeProject, navigate]);

    // Teams handlers removed — v0.1.0

    const handleNewRoutine = useCallback((routine) => {
        addRoutine(routine); setIsNewRoutineOpen(false);
        toast.success(`Rotina "${routine.label}" criada`, { duration: 2000 });
    }, [addRoutine]);

    const handleEditRoutineSave = useCallback((id, updates) => {
        updateRoutine(id, updates); setEditingRoutine(null);
        toast.success("Rotina atualizada", { duration: 2000 });
    }, [updateRoutine]);

    const handleDeleteRoutine = useCallback((id) => {
        deleteRoutine(id); setEditingRoutine(null); navigate("hoje");
        toast.success("Rotina excluída", { duration: 2000 });
    }, [deleteRoutine, navigate]);

    const handleNoteSave = useCallback((id, data) => {
        if (id) { updateNote(id, data); } else { addNote(data); }
    }, [addNote, updateNote]);

    const handleNoteModalClose = useCallback(() => {
        setIsNoteModalOpen(false); setEditingNote(null);
    }, []);

    const handleNoteDelete = useCallback((id) => {
        deleteNote(id);
        toast.success("Anotação excluída", { duration: 2000 });
    }, [deleteNote]);

    // ── Derived data ──
    const filteredTasks = viewFilter ? filterTasksByView(tasks, viewFilter, projects) : [];
    const pendingTasks = filteredTasks.filter((t) => !t.completed);
    const completedTasks = filteredTasks.filter((t) => t.completed);
    const inboxCount = tasks.filter((t) => t.project === "Entrada" && !t.completed).length;

    const taskHandlers = {
        onToggleTask: toggleTask,
        onUpdateTask: updateTask,
        onDeleteTask: deleteTask,
        onGenerateSubtasks: generateSubtasks,
        onToggleSubtask: toggleSubtask,
        onEditTask: setEditingTask,
    };

    return {
        // Theme
        themeCtx,
        // Navigation
        activeView, navigate, viewTitle, viewType, viewFilter,
        // Tasks
        tasks, isAnalyzing, pendingTasks, completedTasks, inboxCount, taskHandlers,
        // Input
        inputRef, inputValue, handleInputChange, handleSubmit,
        // Voice
        isRecording, isTranscribing, elapsedTime, toggleRecording, cancelRecording, mediaStream,
        // Mention
        isMenuOpen, mentionableMembers, selectMember,
        // Projects
        projects, addSubProject, updateSubProject, removeSubProject,
        // Teams
        teams,
        // Routines
        routines, toggleRoutineToday,
        // Notes
        notes, toggleNoteCompletion,
        // Perfil
        saveProfile,
        // UI state — modals
        isSearchOpen, setIsSearchOpen,
        isQuickAddOpen, setIsQuickAddOpen,
        isCreateTaskOpen, setIsCreateTaskOpen,
        editingTask, setEditingTask,
        isNewProjectOpen, setIsNewProjectOpen,
        editingProject, setEditingProject,
        isNewRoutineOpen, setIsNewRoutineOpen,
        editingRoutine, setEditingRoutine,
        selectedCalendarDate, setSelectedCalendarDate,
        isNoteModalOpen, setIsNoteModalOpen,
        editingNote, setEditingNote,
        // CRUD handlers
        handleTaskCreate,
        handleTaskEditSave, handleTaskEditDelete,
        handleNewProject, handleEditProjectSave, handleDeleteProject,

        handleNewRoutine, handleEditRoutineSave, handleDeleteRoutine,
        handleNoteSave, handleNoteModalClose, handleNoteDelete,
        // Helpers
        getFormattedDate,
    };
}

export function AppProvider({ children }) {
    const value = useAppProvider();
    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
