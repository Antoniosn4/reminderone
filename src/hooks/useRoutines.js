// =============================================================
//  useRoutines.js
//  Custom Hook — CRUD de rotinas inteligentes, sobre o
//  armazenamento de registros (sincronizado com o celular).
// =============================================================

import { useCallback, useMemo } from "react";
import { useCollection, useData } from "../data/DataContext";
import { localDateISO, routineToDesktop, toggleRoutineDate } from "../data/mappers";
import { generateId } from "../utils/id";

const DEFAULT_TIME = "08:00";
const DEFAULT_ICON = "CheckCircle2";
const DEFAULT_COLOR = "text-indigo-400";

export function useRoutines() {
    const { store } = useData();
    const records = useCollection("routine");
    const routines = useMemo(
        () => records.map(routineToDesktop).sort((a, b) => a.time.localeCompare(b.time) || a.label.localeCompare(b.label)),
        [records],
    );

    const addRoutine = useCallback((routine) => {
        if (!routine?.label?.trim()) return;
        store.write("routine", `routine_${generateId()}`, {
            label: routine.label.trim(),
            time: routine.time || DEFAULT_TIME,
            icon: routine.icon || DEFAULT_ICON,
            color: routine.color || DEFAULT_COLOR,
            streak: 0,
            aiAdjusted: false,
            completedDates: [],
            createdAt: new Date().toISOString(),
        });
    }, [store]);

    const updateRoutine = useCallback((id, updates) => {
        if (!store.get("routine", id)) return;
        const changes = {};
        for (const field of ["label", "time", "icon", "color"]) {
            if (updates[field] !== undefined) changes[field] = updates[field];
        }
        store.write("routine", id, changes);
    }, [store]);

    const deleteRoutine = useCallback((id) => {
        store.remove("routine", id);
    }, [store]);

    /**
     * Toggle do "feito hoje" (dia no fuso do computador). Guarda as últimas
     * 14 datas em `completedDates`, como o celular.
     */
    const toggleRoutineToday = useCallback((id) => {
        const routine = store.get("routine", id);
        if (!routine) return;
        store.write("routine", id, { completedDates: toggleRoutineDate(routine.completedDates, localDateISO()) });
    }, [store]);

    return { routines, addRoutine, updateRoutine, deleteRoutine, toggleRoutineToday };
}
