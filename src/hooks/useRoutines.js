// =============================================================
//  useRoutines.js
//  Custom Hook — CRUD de rotinas inteligentes.
//  Persistência via localStorage criptografado.
// =============================================================

import { useCallback } from "react";
import { usePersistedState } from "./usePersistedState";
import { generateId } from "../utils/id";

const STORAGE_KEY = "reminder-routines-encrypted";
const DEFAULT_TIME = "08:00";
const DEFAULT_ICON = "CheckCircle2";
const DEFAULT_COLOR = "text-indigo-400";

const DEFAULT_ROUTINES = [];

export function useRoutines() {
    const [routines, setRoutines] = usePersistedState(STORAGE_KEY, DEFAULT_ROUTINES);

    const addRoutine = useCallback((routine) => {
        if (!routine?.label?.trim()) return;
        setRoutines((prev) => [
            ...prev,
            {
                id: `routine_${generateId()}`,
                label: routine.label.trim(),
                time: routine.time || DEFAULT_TIME,
                icon: routine.icon || DEFAULT_ICON,
                color: routine.color || DEFAULT_COLOR,
                streak: 0,
                aiAdjusted: false,
            },
        ]);
    }, [setRoutines]);

    const updateRoutine = useCallback((id, updates) => {
        setRoutines((prev) =>
            prev.map((r) => (r.id === id ? { ...r, ...updates } : r))
        );
    }, [setRoutines]);

    const deleteRoutine = useCallback((id) => {
        setRoutines((prev) => prev.filter((r) => r.id !== id));
    }, [setRoutines]);

    /**
     * Toggle do "feito hoje". Persiste apenas as últimas 14 datas distintas
     * em `completedDates` para alimentar o histórico semanal.
     */
    const toggleRoutineToday = useCallback((id) => {
        const todayISO = new Date().toISOString().split("T")[0];
        setRoutines((prev) =>
            prev.map((routine) => {
                if (routine.id !== id) return routine;
                const previousDates = routine.completedDates ?? [];
                const isDone = previousDates.includes(todayISO);
                const nextDates = isDone
                    ? previousDates.filter((d) => d !== todayISO)
                    : [todayISO, ...previousDates].slice(0, 14);
                return { ...routine, completedDates: nextDates };
            }),
        );
    }, [setRoutines]);

    return { routines, addRoutine, updateRoutine, deleteRoutine, toggleRoutineToday };
}
