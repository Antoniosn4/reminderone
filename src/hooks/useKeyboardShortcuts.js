// =============================================================
//  useKeyboardShortcuts.js
//  Hook único para registrar atalhos globais.
//  Cada atalho é declarativo: { combo: "ctrl+k", handler: () => ... }.
//
//  Princípios:
//    - Não dispara se o usuário está digitando em <input>/<textarea>
//      (a menos que o atalho seja explicitamente "global").
//    - Cleanup automático: remove o listener no unmount.
//    - "Mod" abstrai Ctrl no Windows/Linux e Cmd no macOS.
// =============================================================

import { useEffect, useMemo } from "react";

const TYPING_TARGETS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

function isTypingInElement(target) {
    if (!target) return false;
    if (TYPING_TARGETS.has(target.tagName)) return true;
    return Boolean(target.isContentEditable);
}

function normalizeCombo(combo) {
    return combo
        .toLowerCase()
        .split("+")
        .map((part) => part.trim())
        .sort()
        .join("+");
}

function describeEvent(event) {
    const parts = [];
    if (event.ctrlKey || event.metaKey) parts.push("mod");
    if (event.shiftKey) parts.push("shift");
    if (event.altKey) parts.push("alt");

    const key = event.key.toLowerCase();
    if (key !== "control" && key !== "meta" && key !== "shift" && key !== "alt") {
        parts.push(key);
    }
    return parts.sort().join("+");
}

/**
 * @param {Array<{ combo: string, handler: (event: KeyboardEvent) => void, allowInInput?: boolean }>} shortcuts
 * @param {{ enabled?: boolean }} [options]
 */
export function useKeyboardShortcuts(shortcuts, { enabled = true } = {}) {
    const map = useMemo(() => {
        const dict = new Map();
        for (const shortcut of shortcuts) {
            dict.set(normalizeCombo(shortcut.combo), shortcut);
        }
        return dict;
    }, [shortcuts]);

    useEffect(() => {
        if (!enabled) return undefined;

        const handleKey = (event) => {
            const combo = describeEvent(event);
            const shortcut = map.get(combo);
            if (!shortcut) return;
            if (!shortcut.allowInInput && isTypingInElement(event.target)) return;

            event.preventDefault();
            shortcut.handler(event);
        };

        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [enabled, map]);
}
