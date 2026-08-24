// =============================================================
//  calendarService.js
//  Camada de integração com o backend Google Calendar.
//  Responsabilidade única: comunicação com os endpoints /api/calendar/*.
//
//  SEGURANÇA: Tokens OAuth ficam em server/token.json (nunca no browser).
//  URL relativa — o proxy do Vite encaminha ao servidor Python.
// =============================================================

import { apiUrl } from "./apiBase";
import { logger } from "../utils/logger";

const BASE_PATH = "/api/calendar";

/**
 * Verifica se o usuário já autorizou o acesso ao Google Calendar.
 * @returns {Promise<{ connected: boolean, reason: string|null }>}
 */
export async function getCalendarStatus() {
    try {
        const res = await fetch(apiUrl(`${BASE_PATH}/status`));
        if (!res.ok) {
            return { connected: false, reason: `Servidor respondeu ${res.status}` };
        }
        const data = await res.json();
        return {
            connected: data.connected === true,
            reason: typeof data.reason === "string" ? data.reason : null,
        };
    } catch {
        return { connected: false, reason: "offline" };
    }
}

/**
 * Dispara o fluxo OAuth2: o backend abre o browser com a URL do Google.
 * O usuário autoriza → Google redireciona para o callback do backend.
 * @returns {Promise<{ ok: boolean, reason?: string }>}
 */
export async function connectCalendar() {
    try {
        const res = await fetch(apiUrl(`${BASE_PATH}/auth`));
        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: res.statusText }));
            const reason = err.detail ?? "Erro ao iniciar autorização OAuth";
            logger.error("[calendarService] Backend recusou autorização:", reason);
            return { ok: false, reason };
        }
        return { ok: true };
    } catch (error) {
        logger.error("[calendarService] Falha ao iniciar autorização OAuth:", error);
        return { ok: false, reason: "Servidor local indisponível" };
    }
}

/**
 * Desconecta a conta Google removendo o token OAuth no servidor.
 * @returns {Promise<boolean>} true se desconectado com sucesso.
 */
export async function disconnectCalendar() {
    try {
        const res = await fetch(apiUrl(`${BASE_PATH}/disconnect`), { method: "POST" });
        return res.ok;
    } catch (error) {
        logger.error("[calendarService] Falha ao desconectar:", error);
        return false;
    }
}

/**
 * Cria ou atualiza um evento no Google Calendar para a tarefa.
 * Se a tarefa já tiver `gcalEventId`, o evento existente é atualizado.
 *
 * @param {object} task - Objeto da tarefa (precisa ter `title`, `time` e opcionalmente `gcalEventId`).
 * @returns {Promise<string|null>} O ID do evento no Google Calendar, ou null em caso de falha.
 */
export async function syncTask(task) {
    try {
        const res = await fetch(apiUrl(`${BASE_PATH}/sync`), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ task }),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: res.statusText }));
            logger.error("[calendarService] Falha ao sincronizar tarefa:", err.detail);
            return null;
        }

        const data = await res.json();
        return data.eventId ?? null;
    } catch (error) {
        logger.error("[calendarService] Servidor indisponível:", error);
        return null;
    }
}

/**
 * Remove um evento do Google Calendar pelo seu ID.
 * @param {string} eventId - ID do evento a ser removido.
 * @returns {Promise<boolean>} true se removido com sucesso.
 */
export async function deleteCalendarEvent(eventId) {
    if (!eventId) return false;
    try {
        const res = await fetch(apiUrl(`${BASE_PATH}/event/${encodeURIComponent(eventId)}`), {
            method: "DELETE",
        });
        return res.ok;
    } catch (error) {
        logger.error("[calendarService] Falha ao remover evento:", error);
        return false;
    }
}
