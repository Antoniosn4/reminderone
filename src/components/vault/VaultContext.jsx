// =============================================================
//  VaultContext.jsx
//  Provider React que gerencia o estado do vault em memória:
//    - status: loading | needs_setup | locked | unlocked
//    - key   : CryptoKey AES-GCM (apenas em RAM, nunca persistida)
//
//  Responsabilidades adicionais:
//    - Auto-lock após inatividade (configurável pelo usuário)
//    - Auto-lock ao perder foco da janela por tempo prolongado
//    - Disparar migração one-time logo após primeiro unlock
// =============================================================

import {
    createContext,
    useContext,
    useState,
    useCallback,
    useEffect,
    useRef,
} from "react";
import {
    isVaultInitialized,
    setupVault,
    unlockVault,
    getLockoutDelayMs,
} from "../../services/vaultService";
import { runMigrationIfNeeded } from "../../services/migrationService";
import {
    loadProfile,
    saveProfile as persistProfile,
} from "../../services/profileService";
import { logger } from "../../utils/logger";

const ACTIVITY_CHECK_MS = 30_000;

const LOCK_TIMEOUT_STORAGE_KEY = "reminder-lock-timeout";

const LOCK_TIMEOUT_OPTIONS = Object.freeze([
    { label: "Nunca",    value: 0 },
    { label: "5 min",    value: 5 * 60_000 },
    { label: "15 min",   value: 15 * 60_000 },
    { label: "30 min",   value: 30 * 60_000 },
    { label: "1 hora",   value: 60 * 60_000 },
]);

function loadLockTimeout() {
    try {
        const raw = localStorage.getItem(LOCK_TIMEOUT_STORAGE_KEY);
        if (raw === null) return 0;
        const parsed = Number(raw);
        return LOCK_TIMEOUT_OPTIONS.some((o) => o.value === parsed) ? parsed : 0;
    } catch { return 0; }
}

const VAULT_STATUS = Object.freeze({
    LOADING: "loading",
    NEEDS_SETUP: "needs_setup",
    LOCKED: "locked",
    UNLOCKED: "unlocked",
});

const VaultContext = createContext(null);

export function VaultProvider({ children }) {
    const [status, setStatus] = useState(VAULT_STATUS.LOADING);
    const [key, setKey] = useState(null);
    const [profile, setProfileState] = useState(() => loadProfile());
    const [lockTimeout, setLockTimeoutState] = useState(loadLockTimeout);
    const lastActivityRef = useRef(Date.now());

    useEffect(() => {
        setStatus(isVaultInitialized() ? VAULT_STATUS.LOCKED : VAULT_STATUS.NEEDS_SETUP);
    }, []);

    const lock = useCallback(() => {
        setKey(null);
        setStatus(VAULT_STATUS.LOCKED);
    }, []);

    const finalizeUnlock = useCallback(async (newKey) => {
        await runMigrationIfNeeded(newKey);
        setKey(newKey);
        setStatus(VAULT_STATUS.UNLOCKED);
        lastActivityRef.current = Date.now();
    }, []);

    /**
     * Cria o vault e persiste o perfil (nome + email).
     * Profile é gravado em plaintext porque não é segredo —
     * apenas metadado de identificação para a UI.
     */
    const setup = useCallback(async (password, profileData) => {
        if (profileData) {
            persistProfile(profileData);
            setProfileState(profileData);
        }
        const newKey = await setupVault(password);
        await finalizeUnlock(newKey);
    }, [finalizeUnlock]);

    const unlock = useCallback(async (password) => {
        const newKey = await unlockVault(password);
        if (!newKey) return false;
        await finalizeUnlock(newKey);
        return true;
    }, [finalizeUnlock]);

    const updateProfile = useCallback((next) => {
        persistProfile(next);
        setProfileState(next);
    }, []);

    const setLockTimeout = useCallback((ms) => {
        setLockTimeoutState(ms);
        try { localStorage.setItem(LOCK_TIMEOUT_STORAGE_KEY, String(ms)); }
        catch { /* quota exceeded — ignore */ }
    }, []);

    // ── Auto-lock por inatividade (desativado quando lockTimeout === 0) ──
    useEffect(() => {
        if (status !== VAULT_STATUS.UNLOCKED || lockTimeout === 0) return;

        const markActivity = () => { lastActivityRef.current = Date.now(); };
        const events = ["mousedown", "keydown", "touchstart", "wheel"];
        events.forEach((evt) => window.addEventListener(evt, markActivity, { passive: true }));

        const interval = setInterval(() => {
            if (Date.now() - lastActivityRef.current > lockTimeout) {
                logger.info("[vault] auto-lock por inatividade");
                lock();
            }
        }, ACTIVITY_CHECK_MS);

        return () => {
            events.forEach((evt) => window.removeEventListener(evt, markActivity));
            clearInterval(interval);
        };
    }, [status, lock, lockTimeout]);

    // ── Auto-lock ao perder foco prolongado (desativado quando lockTimeout === 0) ──
    useEffect(() => {
        if (status !== VAULT_STATUS.UNLOCKED || lockTimeout === 0) return;

        let hideTimeoutId = null;

        const handleVisibility = () => {
            if (document.visibilityState === "hidden") {
                hideTimeoutId = setTimeout(() => {
                    if (document.visibilityState === "hidden") lock();
                }, lockTimeout);
            } else if (hideTimeoutId) {
                clearTimeout(hideTimeoutId);
                hideTimeoutId = null;
            }
        };

        document.addEventListener("visibilitychange", handleVisibility);
        return () => {
            document.removeEventListener("visibilitychange", handleVisibility);
            if (hideTimeoutId) clearTimeout(hideTimeoutId);
        };
    }, [status, lock, lockTimeout]);

    const value = {
        status,
        key,
        profile,
        setup,
        unlock,
        lock,
        updateProfile,
        getLockoutDelayMs,
        lockTimeout,
        setLockTimeout,
    };

    return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}

export function useVault() {
    const ctx = useContext(VaultContext);
    if (!ctx) throw new Error("useVault deve ser usado dentro de VaultProvider");
    return ctx;
}

export { VAULT_STATUS, LOCK_TIMEOUT_OPTIONS };
