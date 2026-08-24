// =============================================================
//  profileService.js
//  Persistência local (plaintext) do perfil do usuário.
//
//  Por que plaintext?
//    - Nome e e-mail são metadados de identificação, não segredos.
//    - O e-mail é pré-preenchido na tela de login para UX (autofill
//      do navegador / WebView consegue enxergar e oferecer auto-complete).
//    - A SENHA mestra continua sendo a única coisa secreta — e nunca é
//      persistida em lugar nenhum.
//    - Em caso de exposição local (malware com acesso a localStorage),
//      vazar nome/e-mail não compromete a confidencialidade dos dados
//      protegidos por AES-GCM.
// =============================================================

import { logger } from "../utils/logger";

const PROFILE_KEY = "reminder-profile";

/** @typedef {{ name: string, email: string }} Profile */

/** @returns {Profile | null} */
export function loadProfile() {
    try {
        const raw = localStorage.getItem(PROFILE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        logger.error("[profileService] Falha ao ler perfil:", error);
        return null;
    }
}

/** @param {Profile} profile */
export function saveProfile(profile) {
    try {
        localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    } catch (error) {
        logger.error("[profileService] Falha ao gravar perfil:", error);
    }
}

export function clearProfile() {
    localStorage.removeItem(PROFILE_KEY);
}
