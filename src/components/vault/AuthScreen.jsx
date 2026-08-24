// =============================================================
//  AuthScreen.jsx
//  Tela de autenticação por PIN de 4 dígitos.
//
//  Fluxo:
//    - Primeiro acesso (needs_setup): criar PIN → confirmar PIN.
//    - Acessos seguintes (locked): digitar PIN para desbloquear.
//    - "Esqueceu o PIN?" → confirmação dupla → factory reset.
//
//  Segurança:
//    - PIN de 4 dígitos tem apenas 10.000 combinações.
//      Compensado pelo backoff escalonado em vaultService.
//    - O PIN nunca é persistido; só a chave derivada via PBKDF2
//      + canary cifrado permitem validação.
// =============================================================

import { useState, useEffect, useMemo, useCallback } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { VaultLayout } from "./VaultLayout";
import { PinInput, PIN_LENGTH } from "./PinInput";
import { useVault, VAULT_STATUS } from "./VaultContext";
import { factoryReset } from "../../services/factoryReset";
import { logger } from "../../utils/logger";

const LOCKOUT_TICK_MS = 250;

const STEPS = Object.freeze({
    CREATE: "create",
    CONFIRM: "confirm",
    UNLOCK: "unlock",
});

const COPY = {
    [STEPS.CREATE]: {
        title: "Criar PIN de acesso",
        subtitle: "Escolha um PIN de 4 dígitos para proteger seus dados",
    },
    [STEPS.CONFIRM]: {
        title: "Confirmar PIN",
        subtitle: "Digite o PIN novamente para confirmar",
    },
    [STEPS.UNLOCK]: {
        title: "Bem-vindo de volta",
        subtitle: "Digite seu PIN para acessar o workspace",
    },
};

export function AuthScreen() {
    const { status, setup, unlock, getLockoutDelayMs } = useVault();

    const initialStep = status === VAULT_STATUS.NEEDS_SETUP ? STEPS.CREATE : STEPS.UNLOCK;
    const [step, setStep] = useState(initialStep);
    const [pin, setPin] = useState("");
    const [firstPin, setFirstPin] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [lockoutMs, setLockoutMs] = useState(() => getLockoutDelayMs());
    const [shake, setShake] = useState(false);

    const copy = COPY[step];
    const isLocked = lockoutMs > 0;

    useEffect(() => {
        if (lockoutMs <= 0) return;
        const interval = setInterval(() => {
            const remaining = getLockoutDelayMs();
            setLockoutMs(remaining);
            if (remaining <= 0) clearInterval(interval);
        }, LOCKOUT_TICK_MS);
        return () => clearInterval(interval);
    }, [lockoutMs, getLockoutDelayMs]);

    const triggerShake = useCallback(() => {
        setShake(true);
        setTimeout(() => setShake(false), 500);
    }, []);

    const clearPin = useCallback(() => setPin(""), []);

    const isComplete = useMemo(() => {
        const digits = pin.replace(/\D/g, "");
        return digits.length === PIN_LENGTH;
    }, [pin]);

    const handlePinChange = useCallback((value) => {
        setPin(value);
        if (error) setError(null);
    }, [error]);

    const handleSubmitCreate = useCallback(async () => {
        setFirstPin(pin);
        setPin("");
        setStep(STEPS.CONFIRM);
    }, [pin]);

    const handleSubmitConfirm = useCallback(async () => {
        if (pin !== firstPin) {
            setError("Os PINs não conferem. Tente novamente.");
            triggerShake();
            clearPin();
            setFirstPin("");
            setStep(STEPS.CREATE);
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            await setup(pin, null);
        } catch (err) {
            logger.error("[AuthScreen] setup error:", err);
            setError("Erro ao criar o vault. Tente novamente.");
            setStep(STEPS.CREATE);
        } finally {
            setIsLoading(false);
            clearPin();
            setFirstPin("");
        }
    }, [pin, firstPin, setup, triggerShake, clearPin]);

    const handleSubmitUnlock = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const ok = await unlock(pin);
            if (!ok) {
                setError("PIN incorreto");
                setLockoutMs(getLockoutDelayMs());
                triggerShake();
            }
        } catch (err) {
            if (err?.code === "LOCKED_OUT") {
                setError(`Aguarde ${Math.ceil(err.retryInMs / 1000)}s antes de tentar de novo`);
                setLockoutMs(err.retryInMs);
            } else {
                logger.error("[AuthScreen] unlock error:", err);
                setError("Erro inesperado. Tente novamente.");
            }
        } finally {
            setIsLoading(false);
            clearPin();
        }
    }, [pin, unlock, getLockoutDelayMs, triggerShake, clearPin]);

    const handleSubmit = useCallback(async (e) => {
        e?.preventDefault?.();
        if (!isComplete || isLoading || isLocked) return;

        if (step === STEPS.CREATE) return handleSubmitCreate();
        if (step === STEPS.CONFIRM) return handleSubmitConfirm();
        return handleSubmitUnlock();
    }, [step, isComplete, isLoading, isLocked, handleSubmitCreate, handleSubmitConfirm, handleSubmitUnlock]);

    useEffect(() => {
        if (isComplete && !isLoading && !isLocked) {
            const timer = setTimeout(() => handleSubmit(), 150);
            return () => clearTimeout(timer);
        }
    }, [isComplete, isLoading, isLocked, handleSubmit]);

    const handleForgotPin = async () => {
        const proceed = window.confirm(
            "Seu PIN é a única chave dos seus dados. Sem ele é criptograficamente " +
            "impossível recuperá-los.\n\n" +
            "A única alternativa é APAGAR todos os dados locais e recomeçar.\n\n" +
            "Deseja continuar?",
        );
        if (!proceed) return;

        const confirmed = window.confirm(
            "CONFIRMAÇÃO FINAL\n\n" +
            "Tarefas, projetos, equipes, rotinas e todo o histórico " +
            "serão apagados PERMANENTEMENTE.\n\n" +
            "Continuar?",
        );
        if (!confirmed) return;

        try {
            await factoryReset();
        } catch (err) {
            logger.error("[AuthScreen] factoryReset falhou:", err);
        } finally {
            window.location.reload();
        }
    };

    const ctaLabel = step === STEPS.CREATE
        ? "Definir PIN"
        : step === STEPS.CONFIRM
            ? "Confirmar PIN"
            : "Desbloquear";

    return (
        <VaultLayout
            title={copy.title}
            subtitle={copy.subtitle}
            footer={
                step === STEPS.UNLOCK ? (
                    <button
                        type="button"
                        onClick={handleForgotPin}
                        className="text-xs font-bold text-gray-500 hover:text-gray-300 transition-colors"
                    >
                        Esqueceu o PIN?
                    </button>
                ) : step === STEPS.CONFIRM ? (
                    <button
                        type="button"
                        onClick={() => { setStep(STEPS.CREATE); clearPin(); setFirstPin(""); setError(null); }}
                        className="text-xs font-bold text-gray-500 hover:text-gray-300 transition-colors"
                    >
                        Voltar e escolher outro PIN
                    </button>
                ) : null
            }
        >
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className={shake ? "animate-shake" : ""}>
                    <PinInput
                        value={pin}
                        onChange={handlePinChange}
                        disabled={isLoading || isLocked}
                        error={!!error}
                        autoFocus
                    />
                </div>

                {error && (
                    <div className="flex items-center justify-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        {error}
                    </div>
                )}

                {isLocked && (
                    <p className="text-xs text-center text-amber-400">
                        Aguarde {Math.ceil(lockoutMs / 1000)}s antes da próxima tentativa
                    </p>
                )}

                {step === STEPS.CREATE && !error && (
                    <p className="text-[11px] text-gray-500 text-center leading-relaxed px-4">
                        Este PIN será a única chave dos seus dados.
                        Não há recuperação — memorize-o com segurança.
                    </p>
                )}

                <button
                    type="submit"
                    disabled={!isComplete || isLoading || isLocked}
                    className="w-full py-4 mt-2 bg-gray-100 hover:bg-white text-gray-900 text-sm font-bold rounded-xl transition-all shadow-lg transform active:scale-[0.98] flex items-center justify-center disabled:opacity-50 disabled:hover:bg-gray-100 disabled:active:scale-100 disabled:cursor-not-allowed"
                >
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : ctaLabel}
                </button>
            </form>
        </VaultLayout>
    );
}
