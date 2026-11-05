// =============================================================
//  factoryReset.js
//  Apaga IRREVERSIVELMENTE todos os dados locais do Reminder.
//  Usado pelo fluxo "Esqueceu a senha?" — como a senha mestra
//  é a única chave criptográfica, sem ela os dados não podem
//  ser recuperados. A única alternativa honesta é começar do zero.
//
//  Itens apagados:
//    - Vault meta (salt, canary) e contadores de tentativa
//    - Perfil (nome, e-mail)
//    - Coleções cifradas (projetos, equipes, rotinas)
//    - Flag de migração one-time
//    - IndexedDB com tarefas cifradas
//    - Caches plaintext residuais de migração antiga (defensive)
// =============================================================

import { destroyVault } from "./vaultService";
import { clearProfile } from "./profileService";
import { logger } from "../utils/logger";
import { localStorageFlushed, MIRROR_DB_NAME } from "./durableLocalStorage";

const LOCAL_STORAGE_KEYS = [
    "reminder-custom-projects-encrypted",
    "reminder-teams-encrypted",
    "reminder-routines-encrypted",
    "reminder-migration-v1-done",
    "reminder-lock-timeout",
    "reminder-theme",
    "reminder_notes",
    "reminder_kanban_board",
    "reminder-sync-key",
    "reminder-device-id",
    // Resíduos de versões pré-vault, removidos por defensive cleanup.
    "reminder-custom-projects",
    "reminder-teams",
    "reminder-routines",
];

const INDEXED_DB_NAMES = ["reminder-db", "reminder-data", MIRROR_DB_NAME];

function deleteIndexedDb(dbName) {
    return new Promise((resolve) => {
        const request = indexedDB.deleteDatabase(dbName);
        request.onsuccess = () => resolve();
        request.onerror = () => {
            logger.error(`[factoryReset] Falha ao apagar IDB ${dbName}`);
            resolve();
        };
        // Outras abas podem segurar a conexão; seguimos adiante mesmo assim.
        request.onblocked = () => resolve();
    });
}

/**
 * Apaga todo o estado local do app. Após executar, recomenda-se
 * `window.location.reload()` para reinicializar o React em estado limpo.
 */
export async function factoryReset() {
    destroyVault();
    clearProfile();
    LOCAL_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
    await localStorageFlushed();
    await Promise.all(INDEXED_DB_NAMES.map(deleteIndexedDb));
}
