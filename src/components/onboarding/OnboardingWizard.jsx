// =============================================================
//  OnboardingWizard.jsx
//  Fluxo guiado de configuração inicial após primeiro vault setup.
//
//  Steps:
//    1. Boas-vindas — explicação do app
//    2. Gemini API Key — configurar chave para IA
//    3. Google Calendar — conectar (opcional)
//    4. Pronto — tudo configurado
//
//  A chave Gemini é salva criptografada no vault via secureLocalStorage.
//  O wizard só aparece UMA vez (flag persiste em localStorage).
// =============================================================

import { useState, useCallback } from "react";
import { Sparkles, Key, Calendar, CheckCircle2, ArrowRight, ArrowLeft, X, ExternalLink, Shield, Eye, EyeOff, Loader2, AlertTriangle } from "lucide-react";
import { useVault } from "../vault/VaultContext";
import { writeEncrypted, readEncrypted } from "../../services/secureLocalStorage";
import { getCalendarStatus, connectCalendar } from "../../services/calendarService";
import { logger } from "../../utils/logger";

const ONBOARDING_DONE_KEY = "reminder-onboarding-done";
const GEMINI_KEY_STORAGE_KEY = "reminder-gemini-key";

/** Check if onboarding was already completed. */
export function isOnboardingDone() {
    try {
        return localStorage.getItem(ONBOARDING_DONE_KEY) === "true";
    } catch {
        return false;
    }
}

/** Mark onboarding as completed. */
function markOnboardingDone() {
    try {
        localStorage.setItem(ONBOARDING_DONE_KEY, "true");
    } catch { /* ignore */ }
}

/**
 * Load the saved Gemini API key from encrypted storage.
 * @param {CryptoKey} key - The vault encryption key.
 * @returns {Promise<string>}
 */
export async function loadGeminiKey(key) {
    const data = await readEncrypted(key, GEMINI_KEY_STORAGE_KEY, null);
    return data?.apiKey ?? "";
}

/**
 * Save the Gemini API key to encrypted storage.
 * @param {CryptoKey} key - The vault encryption key.
 * @param {string} apiKey - The Gemini API key to save.
 */
export async function saveGeminiKey(key, apiKey) {
    await writeEncrypted(key, GEMINI_KEY_STORAGE_KEY, { apiKey });
}

const STEPS = [
    { id: "welcome",  label: "Bem-vindo",     icon: Sparkles },
    { id: "gemini",   label: "Chave Gemini",  icon: Key },
    { id: "calendar", label: "Google Calendar", icon: Calendar },
    { id: "done",     label: "Pronto!",       icon: CheckCircle2 },
];

export function OnboardingWizard({ onComplete }) {
    const { key } = useVault();
    const [step, setStep] = useState(0);
    const [geminiKey, setGeminiKey] = useState("");
    const [showKey, setShowKey] = useState(false);
    const [calendarConnected, setCalendarConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [connectError, setConnectError] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    const currentStep = STEPS[step];
    const isFirst = step === 0;
    const isLast = step === STEPS.length - 1;

    const handleNext = useCallback(async () => {
        // Save Gemini key when leaving the Gemini step
        if (currentStep.id === "gemini" && geminiKey.trim()) {
            setIsSaving(true);
            try {
                await saveGeminiKey(key, geminiKey.trim());
                logger.info("[Onboarding] Gemini API key saved (encrypted)");
            } catch (err) {
                logger.error("[Onboarding] Failed to save Gemini key:", err);
            } finally {
                setIsSaving(false);
            }
        }

        if (isLast) {
            markOnboardingDone();
            onComplete();
            return;
        }
        setStep((s) => Math.min(s + 1, STEPS.length - 1));
    }, [step, geminiKey, key, isLast, onComplete, currentStep.id]);

    const handleBack = useCallback(() => {
        setStep((s) => Math.max(s - 1, 0));
    }, []);

    const handleSkip = useCallback(() => {
        markOnboardingDone();
        onComplete();
    }, [onComplete]);

    const handleConnectCalendar = useCallback(async () => {
        setConnectError(null);
        setIsConnecting(true);
        try {
            const result = await connectCalendar();
            if (!result.ok) {
                setConnectError(result.reason ?? "Erro ao iniciar autorização");
                return;
            }
            // Poll status for up to 30s waiting for browser auth
            for (let i = 0; i < 15; i++) {
                await new Promise((r) => setTimeout(r, 2000));
                const status = await getCalendarStatus();
                if (status.connected) {
                    setCalendarConnected(true);
                    break;
                }
            }
        } catch (err) {
            logger.error("[Onboarding] Calendar connect error:", err);
            setConnectError("Erro inesperado ao conectar");
        } finally {
            setIsConnecting(false);
        }
    }, []);

    return (
        <div className="fixed inset-0 bg-gray-900/95 z-[90] flex items-center justify-center p-4 backdrop-blur-lg">
            <div className="w-full max-w-lg animate-in fade-in zoom-in-95 duration-300">

                {/* Progress bar */}
                <div className="flex items-center gap-2 mb-8 px-4">
                    {STEPS.map((s, i) => (
                        <div
                            key={s.id}
                            className={`flex-1 h-1.5 rounded-full transition-all duration-500 ${
                                i <= step ? "bg-indigo-500" : "bg-gray-700"
                            }`}
                        />
                    ))}
                </div>

                {/* Card */}
                <div className="bg-gray-800/80 border border-gray-700/60 rounded-3xl shadow-2xl shadow-black/30 overflow-hidden backdrop-blur-sm">

                    {/* Header */}
                    <div className="flex items-center justify-between p-6 pb-0">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-2xl bg-indigo-500/10">
                                <currentStep.icon className="w-6 h-6 text-indigo-400" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
                                    Passo {step + 1} de {STEPS.length}
                                </p>
                                <h2 className="text-xl font-bold text-gray-100">
                                    {currentStep.label}
                                </h2>
                            </div>
                        </div>
                        <button
                            onClick={handleSkip}
                            title="Pular configuração"
                            className="text-gray-500 hover:text-gray-300 transition-colors p-2 rounded-xl hover:bg-gray-700"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 min-h-[280px] flex flex-col justify-between">
                        <div className="flex-1">
                            {/* ── STEP: Welcome ── */}
                            {currentStep.id === "welcome" && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                    <p className="text-gray-300 leading-relaxed">
                                        O <strong className="text-gray-100">ReminderONE</strong> é seu assistente de produtividade local, com criptografia ponta a ponta.
                                    </p>
                                    <div className="space-y-3">
                                        <div className="flex items-start gap-3 bg-gray-900/50 rounded-xl p-3 border border-gray-700/50">
                                            <Shield className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                                            <div>
                                                <p className="text-sm font-semibold text-gray-200">100% Local & Privado</p>
                                                <p className="text-xs text-gray-500">Todos os dados ficam no seu dispositivo, criptografados com AES-256.</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3 bg-gray-900/50 rounded-xl p-3 border border-gray-700/50">
                                            <Sparkles className="w-5 h-5 text-indigo-400 mt-0.5 flex-shrink-0" />
                                            <div>
                                                <p className="text-sm font-semibold text-gray-200">IA para Tarefas</p>
                                                <p className="text-xs text-gray-500">Crie tarefas com linguagem natural. A IA classifica, prioriza e agenda.</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mt-4">
                                        <p className="text-xs text-amber-300 leading-relaxed">
                                            <strong>⚠️ Importante:</strong> Seu PIN é a única chave dos seus dados. 
                                            Não há recuperação de senha — memorize-o com segurança.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* ── STEP: Gemini API Key ── */}
                            {currentStep.id === "gemini" && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                    <p className="text-sm text-gray-400 leading-relaxed">
                                        A chave da API Gemini permite que a IA processe suas tarefas. 
                                        Ela será <strong className="text-gray-300">salva criptografada</strong> no seu vault.
                                    </p>
                                    <div>
                                        <label
                                            htmlFor="onboarding-gemini-key"
                                            className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2"
                                        >
                                            Gemini API Key
                                        </label>
                                        <div className="relative">
                                            <input
                                                id="onboarding-gemini-key"
                                                type={showKey ? "text" : "password"}
                                                value={geminiKey}
                                                onChange={(e) => setGeminiKey(e.target.value)}
                                                placeholder="AIzaSy..."
                                                autoComplete="off"
                                                spellCheck="false"
                                                className="w-full bg-gray-900 border border-gray-700 text-gray-100 rounded-xl px-4 py-3 pr-12 text-sm focus:outline-none focus:border-gray-500 transition-all shadow-inner font-mono"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowKey((v) => !v)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                                            >
                                                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>
                                    <a
                                        href="https://aistudio.google.com/apikey"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 transition-colors"
                                    >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                        Obter chave gratuita no Google AI Studio
                                    </a>
                                    <p className="text-[11px] text-gray-600 leading-relaxed">
                                        Você pode pular esta etapa e configurar depois em Configurações. 
                                        Sem a chave, a classificação automática de tarefas ficará indisponível.
                                    </p>
                                </div>
                            )}

                            {/* ── STEP: Google Calendar ── */}
                            {currentStep.id === "calendar" && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                    <p className="text-sm text-gray-400 leading-relaxed">
                                        Conecte seu Google Calendar para sincronizar tarefas automaticamente.
                                        Esta etapa é <strong className="text-gray-300">opcional</strong>.
                                    </p>

                                    {calendarConnected ? (
                                        <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                                            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                                            <div>
                                                <p className="text-sm font-semibold text-emerald-300">Google Calendar conectado!</p>
                                                <p className="text-xs text-gray-500">Suas tarefas serão sincronizadas automaticamente.</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={handleConnectCalendar}
                                            disabled={isConnecting}
                                            className="w-full flex items-center justify-center gap-3 bg-gray-900 border border-gray-700 rounded-xl px-4 py-4 hover:border-sky-500/40 hover:bg-gray-900/80 transition-all group disabled:opacity-60"
                                        >
                                            {isConnecting ? (
                                                <>
                                                    <Loader2 className="w-5 h-5 text-sky-400 animate-spin" />
                                                    <span className="text-sm text-gray-300">Aguardando autorização...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Calendar className="w-5 h-5 text-sky-400 group-hover:scale-110 transition-transform" />
                                                    <span className="text-sm font-semibold text-gray-200">Conectar Google Calendar</span>
                                                </>
                                            )}
                                        </button>
                                    )}

                                    {connectError && (
                                        <div className="flex items-start gap-2 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3">
                                            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                            <span>{connectError}</span>
                                        </div>
                                    )}

                                    <p className="text-[11px] text-gray-600 leading-relaxed">
                                        Você pode conectar ou desconectar a qualquer momento nas Configurações.
                                    </p>
                                </div>
                            )}

                            {/* ── STEP: Done ── */}
                            {currentStep.id === "done" && (
                                <div className="space-y-5 text-center animate-in fade-in zoom-in-95 duration-500">
                                    <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center">
                                        <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-100 mb-2">
                                            Tudo pronto!
                                        </h3>
                                        <p className="text-sm text-gray-400 leading-relaxed">
                                            Seu workspace está configurado. Comece criando sua primeira tarefa —
                                            digite ou use o microfone para ditar.
                                        </p>
                                    </div>
                                    <div className="flex flex-col gap-2 text-xs text-gray-500">
                                        {geminiKey.trim() && (
                                            <span className="flex items-center justify-center gap-1.5">
                                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                                Gemini API configurada
                                            </span>
                                        )}
                                        {calendarConnected && (
                                            <span className="flex items-center justify-center gap-1.5">
                                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                                Google Calendar conectado
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Navigation */}
                        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-700/50">
                            {!isFirst ? (
                                <button
                                    type="button"
                                    onClick={handleBack}
                                    className="flex items-center gap-2 text-sm font-semibold text-gray-400 hover:text-gray-200 transition-colors px-4 py-2.5 rounded-xl hover:bg-gray-700"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    Voltar
                                </button>
                            ) : (
                                <div />
                            )}

                            <div className="flex items-center gap-3">
                                {!isLast && currentStep.id !== "welcome" && (
                                    <button
                                        type="button"
                                        onClick={() => setStep((s) => s + 1)}
                                        className="text-sm text-gray-500 hover:text-gray-300 transition-colors px-3 py-2"
                                    >
                                        Pular
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={handleNext}
                                    disabled={isSaving}
                                    className="flex items-center gap-2 px-6 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold rounded-xl transition-all shadow-md transform active:scale-95 disabled:opacity-60"
                                >
                                    {isLast ? "Começar" : "Próximo"}
                                    {!isLast && <ArrowRight className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
