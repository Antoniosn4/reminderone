// =============================================================
//  usePersistedState.js
//  Hook genérico que sincroniza um estado React com a camada
//  de localStorage criptografado. Centraliza a lógica antes
//  duplicada em useProjects/useTeams/useRoutines.
// =============================================================

import { useEffect, useRef, useState } from "react";
import { useVault } from "../components/vault/VaultContext";
import { readEncrypted, writeEncrypted } from "../services/secureLocalStorage";

/**
 * Estado React persistido cifrado em localStorage.
 *
 * @template T
 * @param {string} storageKey - Chave (não secreta) sob a qual o
 *   payload AES-GCM é gravado.
 * @param {T|(() => T)} defaultValue - Valor inicial enquanto
 *   não há nada hidratado, ou para hidratação vazia.
 * @returns {[T, (value: T|((prev: T) => T)) => void, boolean]}
 *   Tuple `[state, setState, hydrated]`.
 */
export function usePersistedState(storageKey, defaultValue) {
    const { key } = useVault();
    const initial = typeof defaultValue === "function" ? defaultValue() : defaultValue;
    const [state, setState] = useState(initial);
    const [hydrated, setHydrated] = useState(false);
    const lastSerializedRef = useRef(null);

    // ── Hidrata quando a vault key fica disponível ──
    useEffect(() => {
        if (!key) return;
        let cancelled = false;
        readEncrypted(key, storageKey, initial).then((loaded) => {
            if (cancelled) return;
            setState(loaded);
            lastSerializedRef.current = JSON.stringify(loaded);
            setHydrated(true);
        });
        return () => { cancelled = true; };
        // initial é estável (capturado uma vez); ignoramos no deps array
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, storageKey]);

    // ── Persiste mudanças após hidratação ──
    useEffect(() => {
        if (!hydrated || !key) return;
        const serialized = JSON.stringify(state);
        if (serialized === lastSerializedRef.current) return;
        lastSerializedRef.current = serialized;
        writeEncrypted(key, storageKey, state);
    }, [state, key, storageKey, hydrated]);

    return [state, setState, hydrated];
}
