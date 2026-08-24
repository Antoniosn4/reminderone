// =============================================================
//  useTheme.js
//  Gerencia o tema ativo (dark / blue / light).
//  Persiste a escolha em plaintext no localStorage (não é dado
//  sensível) e aplica data-theme no <html> para ativar as
//  variáveis CSS correspondentes.
// =============================================================

import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "reminder-theme";
const VALID_THEMES = ["dark", "blue", "light"];
const DEFAULT_THEME = "dark";

function loadSavedTheme() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        return VALID_THEMES.includes(saved) ? saved : DEFAULT_THEME;
    } catch {
        return DEFAULT_THEME;
    }
}

function applyThemeToDOM(theme) {
    document.documentElement.setAttribute("data-theme", theme);
}

export function useTheme() {
    const [theme, setThemeState] = useState(loadSavedTheme);

    useEffect(() => {
        applyThemeToDOM(theme);
    }, [theme]);

    const setTheme = useCallback((next) => {
        if (!VALID_THEMES.includes(next)) return;
        setThemeState(next);
        try { localStorage.setItem(STORAGE_KEY, next); }
        catch { /* ignore */ }
    }, []);

    return { theme, setTheme, themes: VALID_THEMES };
}
