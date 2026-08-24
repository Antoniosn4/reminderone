// =============================================================
//  SettingsView.jsx
//  Tela de configurações do perfil — formulário funcional
//  vinculado ao VaultContext (profile + updateProfile).
//  Avatar é renderizado localmente (sem dependência externa).
// =============================================================

import { useState, useEffect, useCallback } from "react";
import { User, Save, Check, Timer, Palette, Key, Eye, EyeOff, ExternalLink } from "lucide-react";
import { useVault, LOCK_TIMEOUT_OPTIONS } from "../vault/VaultContext";
import { Avatar } from "../Avatar";
import { loadGeminiKey, saveGeminiKey } from "../onboarding/OnboardingWizard";

const PROFILE_AVATAR_SIZE_PX = 88;
const SAVED_FEEDBACK_MS = 2000;

const EMPTY_PROFILE = { name: "", email: "" };

function sanitizeText(value) {
    return value.replace(/[<>]/g, "").trim();
}

function isValidEmail(value) {
    if (!value) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

const THEME_OPTIONS = [
    { value: "dark",  label: "Escuro",  preview: { bg: "#09090b", surface: "#18181b", accent: "#6366f1" } },
    { value: "blue",  label: "Azul",    preview: { bg: "#0f172a", surface: "#1e293b", accent: "#6366f1" } },
    { value: "light", label: "Claro",   preview: { bg: "#fafafc", surface: "#f1f1f3", accent: "#6366f1" } },
];

export function SettingsView({ theme, onThemeChange }) {
    const { key, profile, updateProfile, lockTimeout, setLockTimeout } = useVault();
    const [draft, setDraft] = useState(() => ({ ...EMPTY_PROFILE, ...(profile ?? {}) }));
    const [savedAt, setSavedAt] = useState(null);
    const [emailError, setEmailError] = useState(null);

    useEffect(() => {
        setDraft({ ...EMPTY_PROFILE, ...(profile ?? {}) });
    }, [profile]);

    const isDirty =
        sanitizeText(draft.name) !== (profile?.name ?? "") ||
        sanitizeText(draft.email) !== (profile?.email ?? "");

    const handleChange = useCallback((event) => {
        const { name, value } = event.target;
        setDraft((prev) => ({ ...prev, [name]: value }));
        if (name === "email") setEmailError(null);
    }, []);

    const handleSubmit = useCallback(
        (event) => {
            event.preventDefault();
            const cleanName = sanitizeText(draft.name);
            const cleanEmail = sanitizeText(draft.email);

            if (!isValidEmail(cleanEmail)) {
                setEmailError("E-mail inválido.");
                return;
            }

            updateProfile({ name: cleanName, email: cleanEmail });
            setSavedAt(Date.now());
        },
        [draft, updateProfile],
    );

    useEffect(() => {
        if (!savedAt) return undefined;
        const timeoutId = window.setTimeout(() => setSavedAt(null), SAVED_FEEDBACK_MS);
        return () => window.clearTimeout(timeoutId);
    }, [savedAt]);

    const displayName = sanitizeText(draft.name) || "Usuário";

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <section className="bg-gray-800 border border-gray-700 rounded-2xl p-6 shadow-xl">
                <h2 className="text-lg font-bold text-gray-100 mb-6 flex items-center gap-2">
                    <User className="w-5 h-5 text-gray-400" />
                    Perfil Pessoal
                </h2>

                <form onSubmit={handleSubmit} className="flex items-start gap-8" noValidate>
                    <div className="rounded-full bg-gradient-to-tr from-indigo-500 to-emerald-400 p-[3px] flex-shrink-0">
                        <Avatar name={displayName} size={PROFILE_AVATAR_SIZE_PX} />
                    </div>

                    <div className="flex-1 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label
                                    htmlFor="profile-name"
                                    className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5"
                                >
                                    Nome de Exibição
                                </label>
                                <input
                                    id="profile-name"
                                    name="name"
                                    type="text"
                                    value={draft.name}
                                    onChange={handleChange}
                                    maxLength={64}
                                    autoComplete="name"
                                    className="w-full bg-gray-900 border border-gray-700 text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-500 transition-colors"
                                />
                            </div>
                            <div>
                                <label
                                    htmlFor="profile-email"
                                    className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5"
                                >
                                    E-mail
                                </label>
                                <input
                                    id="profile-email"
                                    name="email"
                                    type="email"
                                    value={draft.email}
                                    onChange={handleChange}
                                    maxLength={128}
                                    autoComplete="email"
                                    aria-invalid={emailError ? "true" : "false"}
                                    className={`w-full bg-gray-900 border text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none transition-colors ${
                                        emailError
                                            ? "border-rose-500/60 focus:border-rose-500"
                                            : "border-gray-700 focus:border-gray-500"
                                    }`}
                                />
                                {emailError && (
                                    <p className="text-xs text-rose-400 mt-1.5">{emailError}</p>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <p className="text-xs text-gray-500">
                                Os dados ficam apenas no seu dispositivo. Nada é enviado para servidores externos.
                            </p>

                            <button
                                type="submit"
                                disabled={!isDirty}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                                    isDirty
                                        ? "bg-indigo-500 hover:bg-indigo-600 text-white"
                                        : "bg-gray-800 text-gray-500 cursor-not-allowed"
                                }`}
                            >
                                {savedAt ? (
                                    <>
                                        <Check className="w-4 h-4" /> Salvo
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-4 h-4" /> Salvar
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </form>
            </section>

            <section className="bg-gray-800 border border-gray-700 rounded-2xl p-6 shadow-xl">
                <h2 className="text-lg font-bold text-gray-100 mb-2 flex items-center gap-2">
                    <Palette className="w-5 h-5 text-gray-400" />
                    Aparência
                </h2>
                <p className="text-sm text-gray-500 mb-4">
                    Escolha o tema visual do aplicativo.
                </p>
                <div className="flex gap-4">
                    {THEME_OPTIONS.map((opt) => (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => onThemeChange(opt.value)}
                            className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                                theme === opt.value
                                    ? "border-indigo-500 ring-2 ring-indigo-500/30"
                                    : "border-gray-700 hover:border-gray-600"
                            }`}
                        >
                            <div
                                className="w-24 h-16 rounded-lg flex items-end p-1.5 gap-1 shadow-inner overflow-hidden"
                                style={{ background: opt.preview.bg }}
                            >
                                <div className="w-5 h-full rounded" style={{ background: opt.preview.surface }} />
                                <div className="flex-1 flex flex-col gap-1 justify-end">
                                    <div className="h-2 rounded-full w-full" style={{ background: opt.preview.surface }} />
                                    <div className="h-2 rounded-full w-3/4" style={{ background: opt.preview.accent }} />
                                    <div className="h-2 rounded-full w-1/2" style={{ background: opt.preview.surface }} />
                                </div>
                            </div>
                            <span className={`text-xs font-semibold ${theme === opt.value ? "text-indigo-400" : "text-gray-400"}`}>
                                {opt.label}
                            </span>
                        </button>
                    ))}
                </div>
            </section>

            <section className="bg-gray-800 border border-gray-700 rounded-2xl p-6 shadow-xl">
                <h2 className="text-lg font-bold text-gray-100 mb-2 flex items-center gap-2">
                    <Timer className="w-5 h-5 text-gray-400" />
                    Bloqueio por Inatividade
                </h2>
                <p className="text-sm text-gray-500 mb-4">
                    Tempo sem interação até o vault ser bloqueado automaticamente.
                </p>
                <div className="flex flex-wrap gap-2">
                    {LOCK_TIMEOUT_OPTIONS.map((opt) => (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => setLockTimeout(opt.value)}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                                lockTimeout === opt.value
                                    ? "bg-indigo-500 text-white"
                                    : "bg-gray-900 border border-gray-600 text-gray-400 hover:text-gray-200 hover:bg-gray-700/80"
                            }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </section>
            <GeminiKeySection vaultKey={key} />

        </div>
    );
}

// ── Gemini API Key Section ──

function GeminiKeySection({ vaultKey }) {
    const [apiKey, setApiKey] = useState("");
    const [showKey, setShowKey] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [savedAt, setSavedAt] = useState(null);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        if (!vaultKey) return;
        loadGeminiKey(vaultKey).then((key) => {
            setApiKey(key || "");
            setIsLoaded(true);
        });
    }, [vaultKey]);

    useEffect(() => {
        if (!savedAt) return undefined;
        const timeoutId = window.setTimeout(() => setSavedAt(null), 2000);
        return () => window.clearTimeout(timeoutId);
    }, [savedAt]);

    const handleSave = useCallback(async () => {
        if (!vaultKey || isSaving) return;
        setIsSaving(true);
        try {
            await saveGeminiKey(vaultKey, apiKey.trim());
            setSavedAt(Date.now());
        } finally {
            setIsSaving(false);
        }
    }, [vaultKey, apiKey, isSaving]);

    if (!isLoaded) return null;

    return (
        <section className="bg-gray-800 border border-gray-700 rounded-2xl p-6 shadow-xl">
            <h2 className="text-lg font-bold text-gray-100 mb-2 flex items-center gap-2">
                <Key className="w-5 h-5 text-gray-400" />
                Chave da API Gemini
            </h2>
            <p className="text-sm text-gray-500 mb-4">
                Necessária para classificação automática de tarefas por IA.
                A chave é armazenada <strong className="text-gray-400">criptografada</strong> no seu vault.
            </p>
            <div className="space-y-3">
                <div className="relative">
                    <input
                        type={showKey ? "text" : "password"}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="AIzaSy..."
                        autoComplete="off"
                        spellCheck="false"
                        className="w-full bg-gray-900 border border-gray-700 text-gray-200 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:border-gray-500 transition-colors font-mono"
                    />
                    <button
                        type="button"
                        onClick={() => setShowKey((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                    >
                        {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                </div>
                <div className="flex items-center justify-between">
                    <a
                        href="https://aistudio.google.com/apikey"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 transition-colors"
                    >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Obter chave gratuita
                    </a>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors bg-indigo-500 hover:bg-indigo-600 text-white disabled:opacity-50"
                    >
                        {savedAt ? (
                            <><Check className="w-4 h-4" /> Salvo</>
                        ) : (
                            <><Save className="w-4 h-4" /> Salvar chave</>
                        )}
                    </button>
                </div>
            </div>
        </section>
    );
}
