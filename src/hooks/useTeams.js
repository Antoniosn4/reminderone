// =============================================================
//  useTeams.js
//  Custom Hook — CRUD de equipes.
//  Persistência via localStorage criptografado.
// =============================================================

import { useCallback } from "react";
import { usePersistedState } from "./usePersistedState";
import { generateId } from "../utils/id";

const STORAGE_KEY = "reminder-teams-encrypted";
const DEFAULT_MEMBERS = 2;

const DEFAULT_TEAMS = [
    { id: "team_marketing", name: "Marketing Q4", members: 4 },
    { id: "team_design", name: "Design System", members: 2 },
    { id: "team_dev", name: "Desenvolvimento", members: 6 },
];

export function useTeams() {
    const [teams, setTeams] = usePersistedState(STORAGE_KEY, DEFAULT_TEAMS);

    const addTeam = useCallback((team) => {
        if (!team?.name?.trim()) return;
        setTeams((prev) => [
            ...prev,
            {
                id: `team_${generateId()}`,
                name: team.name.trim(),
                members: Number(team.members) || DEFAULT_MEMBERS,
            },
        ]);
    }, [setTeams]);

    const updateTeam = useCallback((id, updates) => {
        setTeams((prev) =>
            prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
        );
    }, [setTeams]);

    const deleteTeam = useCallback((id) => {
        setTeams((prev) => prev.filter((t) => t.id !== id));
    }, [setTeams]);

    return { teams, addTeam, updateTeam, deleteTeam };
}
