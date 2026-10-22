// =============================================================
//  useRoutineNotifications.js
//  Dispara uma Notification nativa quando o horário de uma rotina
//  é atingido. Funciona em browser (Notification API) e em Tauri
//  (que injeta a mesma API ao habilitar o plugin de notification).
//
//  Princípios:
//    - Permissão é solicitada uma única vez, no primeiro tick.
//    - Estado de "já disparado hoje" persiste em sessionStorage para
//      sobreviver ao reload sem repetir a notificação no mesmo dia.
//    - Polling barato: 1 verificação por minuto.
//    - Auto-cleanup do conjunto de IDs a cada novo dia.
// =============================================================

import { useEffect, useRef } from "react";
import { logger } from "../utils/logger";
import { localDateISO } from "../data/mappers";

const TICK_INTERVAL_MS = 60_000;
const HHMM_REGEX = /^([01]?\d|2[0-3]):[0-5]\d$/;
const SESSION_KEY_PREFIX = "reminder-routine-fired";
const NOTIFICATION_ICON = "/logonova.png";

function todayKey() {
    return localDateISO();
}

function alreadyFiredToday(routineId) {
    const stored = sessionStorage.getItem(SESSION_KEY_PREFIX);
    if (!stored) return false;
    try {
        const parsed = JSON.parse(stored);
        return parsed.day === todayKey() && parsed.fired.includes(routineId);
    } catch {
        return false;
    }
}

function markFiredToday(routineId) {
    const stored = sessionStorage.getItem(SESSION_KEY_PREFIX);
    let fired = [];
    let day = todayKey();
    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            if (parsed.day === day) fired = parsed.fired ?? [];
        } catch {
            fired = [];
        }
    }
    if (!fired.includes(routineId)) fired.push(routineId);
    sessionStorage.setItem(SESSION_KEY_PREFIX, JSON.stringify({ day, fired }));
}

async function ensurePermission() {
    if (typeof Notification === "undefined") return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;
    try {
        const result = await Notification.requestPermission();
        return result === "granted";
    } catch (error) {
        logger.error("[notifications] Falha ao solicitar permissão:", error);
        return false;
    }
}

function fireNotification(routine) {
    try {
        new Notification(`Rotina: ${routine.label}`, {
            body: `Hora de cumprir sua rotina das ${routine.time}.`,
            icon: NOTIFICATION_ICON,
            tag: `routine-${routine.id}`,
            silent: false,
        });
    } catch (error) {
        logger.error("[notifications] Falha ao disparar:", error);
    }
}

function currentTimeHHMM() {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

/**
 * @param {Array<{ id: string, label: string, time: string }>} routines
 */
export function useRoutineNotifications(routines) {
    const routinesRef = useRef(routines);

    useEffect(() => { routinesRef.current = routines; }, [routines]);

    useEffect(() => {
        let cancelled = false;
        let intervalId;

        async function setup() {
            const granted = await ensurePermission();
            if (!granted || cancelled) return;

            const tick = () => {
                const now = currentTimeHHMM();
                for (const routine of routinesRef.current ?? []) {
                    if (!HHMM_REGEX.test(routine.time)) continue;
                    if (routine.time !== now) continue;
                    if (alreadyFiredToday(routine.id)) continue;
                    fireNotification(routine);
                    markFiredToday(routine.id);
                }
            };

            tick();
            intervalId = setInterval(tick, TICK_INTERVAL_MS);
        }

        setup();

        return () => {
            cancelled = true;
            if (intervalId) clearInterval(intervalId);
        };
    }, []);
}
