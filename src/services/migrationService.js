// =============================================================
//  migrationService.js
//  Migra dados pré-vault (plaintext) para o formato cifrado.
//  Executado uma única vez logo após o primeiro setup ou unlock.
//
//  Fluxo:
//    1. Lê IndexedDB store legado "tasks" e re-grava cifrado em
//       "tasks_encrypted". Em seguida apaga o legado.
//    2. Lê chaves antigas do localStorage (projects, teams,
//       routines), cifra e regrava sob nomes "*-encrypted".
//       Apaga as chaves originais ao final.
// =============================================================

import { readEncrypted, writeEncrypted } from "./secureLocalStorage";
import {
    getLegacyTasks,
    putTask,
    clearLegacyTasks,
} from "./secureStorage";
import { logger } from "../utils/logger";

const LEGACY_LOCAL_KEYS = [
    { from: "reminder-custom-projects", to: "reminder-custom-projects-encrypted" },
    { from: "reminder-teams", to: "reminder-teams-encrypted" },
    { from: "reminder-routines", to: "reminder-routines-encrypted" },
];

const ROUTINES_STORAGE_KEY = "reminder-routines-encrypted";
const MOCK_ROUTINE_IDS = new Set(["routine_vitaminas", "routine_agua"]);

const MIGRATION_FLAG = "reminder-migration-v1-done";
const CLEANUP_MOCKS_FLAG = "reminder-cleanup-mocks-v1-done";

async function migrateLocalStorageKeys(key) {
    for (const { from, to } of LEGACY_LOCAL_KEYS) {
        const raw = localStorage.getItem(from);
        if (!raw) continue;
        try {
            const parsed = JSON.parse(raw);
            await writeEncrypted(key, to, parsed);
            localStorage.removeItem(from);
        } catch (error) {
            logger.error(`[migration] Falha ao migrar ${from}:`, error);
        }
    }
}

async function migrateIndexedDb(key) {
    const legacy = await getLegacyTasks();
    if (legacy.length === 0) return 0;
    for (const task of legacy) {
        await putTask(key, task);
    }
    await clearLegacyTasks();
    return legacy.length;
}

/**
 * Remove rotinas demo legadas ("vitaminas" e "água") que estavam
 * pré-populadas em versões anteriores. Idempotente — só roda uma vez.
 * Rotinas criadas pelo usuário NÃO são afetadas (compara por ID).
 */
async function cleanupMockRoutines(key) {
    if (!key) return;
    if (localStorage.getItem(CLEANUP_MOCKS_FLAG) === "1") return;

    try {
        const routines = await readEncrypted(key, ROUTINES_STORAGE_KEY, null);
        if (Array.isArray(routines)) {
            const filtered = routines.filter((routine) => !MOCK_ROUTINE_IDS.has(routine?.id));
            if (filtered.length !== routines.length) {
                await writeEncrypted(key, ROUTINES_STORAGE_KEY, filtered);
                logger.info("[migration] %d rotina(s) demo removida(s)", routines.length - filtered.length);
            }
        }
        localStorage.setItem(CLEANUP_MOCKS_FLAG, "1");
    } catch (error) {
        logger.error("[migration] Falha ao remover rotinas demo:", error);
    }
}

/**
 * Executa migração one-time. É idempotente: marca conclusão em
 * localStorage e não reexecuta em chamadas futuras.
 * @returns {Promise<{tasks: number, alreadyMigrated: boolean}>}
 */
export async function runMigrationIfNeeded(key) {
    const alreadyMigrated = localStorage.getItem(MIGRATION_FLAG) === "1";

    try {
        let taskCount = 0;
        if (!alreadyMigrated) {
            taskCount = await migrateIndexedDb(key);
            await migrateLocalStorageKeys(key);
            localStorage.setItem(MIGRATION_FLAG, "1");
        }

        await cleanupMockRoutines(key);

        return { tasks: taskCount, alreadyMigrated };
    } catch (error) {
        logger.error("[migration] Erro durante migração:", error);
        return { tasks: 0, alreadyMigrated };
    }
}
