// =============================================================
//  AccountButton.jsx
//  Botão de conta no header: mostra status da conexão Google
//  e abre modal com opções de login/logout.
// =============================================================

import { useState, useCallback, useEffect } from "react";
import {
    X, CalendarCheck, CalendarX, Loader2, ExternalLink,
    AlertTriangle, RefreshCw, LogIn, LogOut,
} from "lucide-react";
import { getCalendarStatus, connectCalendar, disconnectCalendar } from "../services/calendarService";

const CAL_REDIRECT_URI = "http://localhost:8000/api/calendar/callback";

export function AccountButton({ onResyncCalendar, isResyncing }) {
    const [isOpen, setIsOpen] = useState(false);
    const [calendarConnected, setCalendarConnected] = useState(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isDisconnecting, setIsDisconnecting] = useState(false);
    const [loading, setLoading] = useState(true);
    const [connectError, setConnectError] = useState(null);

    const checkStatus = useCallback(async () => {
        try {
            const { connected } = await getCalendarStatus();
            setCalendarConnected(connected);
            setLoading(false);
            return connected;
        } catch {
            setCalendarConnected(false);
            setLoading(false);
            return false;
        }
    }, []);

    useEffect(() => { checkStatus(); }, [checkStatus]);

    useEffect(() => {
        if (!isConnecting) return;
        const interval = setInterval(async () => {
            const connected = await checkStatus();
            if (connected) setIsConnecting(false);
        }, 3000);
        const timeout = setTimeout(() => {
            clearInterval(interval);
            setIsConnecting(false);
        }, 5 * 60_000);
        return () => { clearInterval(interval); clearTimeout(timeout); };
    }, [isConnecting, checkStatus]);

    const handleConnect = useCallback(async () => {
        setConnectError(null);
        setIsConnecting(true);
        const result = await connectCalendar();
        if (!result.ok) {
            setConnectError(result.reason ?? "Erro ao iniciar autorização");
            setIsConnecting(false);
        }
    }, []);

    const handleDisconnect = useCallback(async () => {
        setIsDisconnecting(true);
        const ok = await disconnectCalendar();
        if (ok) setCalendarConnected(false);
        setIsDisconnecting(false);
    }, []);

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="flex items-center gap-2 text-xs font-semibold bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg border border-gray-700 transition-colors text-gray-300"
            >
                {loading
                    ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                    : calendarConnected
                        ? <CalendarCheck className="w-4 h-4 text-emerald-400" />
                        : <LogIn className="w-4 h-4 text-sky-400" />
                }
                {loading ? "Verificando..." : calendarConnected ? "Conectado" : "Entrar"}
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsOpen(false)} />

                    <div className="relative bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-lg p-6 animate-vault-in z-10">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-bold text-gray-100">Conta e Integrações</h2>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <section className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    {loading
                                        ? <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                                        : calendarConnected
                                            ? <CalendarCheck className="w-5 h-5 text-emerald-400" />
                                            : <CalendarX className="w-5 h-5 text-amber-400" />
                                    }
                                    <div>
                                        <p className="text-sm font-semibold text-gray-200">Google Calendar</p>
                                        <p className="text-xs text-gray-500">
                                            {loading ? "Verificando..." : calendarConnected ? "Sincronização ativa" : "Não conectado"}
                                        </p>
                                    </div>
                                </div>

                                {!loading && (
                                    <div className="flex items-center gap-2">
                                        {calendarConnected && (
                                            <button
                                                onClick={() => { onResyncCalendar?.(); }}
                                                disabled={isResyncing}
                                                className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 bg-gray-900 px-3 py-1.5 rounded-lg border border-gray-600 transition-colors disabled:opacity-50"
                                            >
                                                <RefreshCw className={`w-3.5 h-3.5 ${isResyncing ? "animate-spin" : ""}`} />
                                                Sincronizar
                                            </button>
                                        )}
                                        {calendarConnected ? (
                                            <button
                                                onClick={handleDisconnect}
                                                disabled={isDisconnecting}
                                                className="flex items-center gap-1.5 text-xs font-semibold text-rose-400 hover:text-rose-300 bg-gray-900 px-3 py-1.5 rounded-lg border border-gray-600 transition-colors disabled:opacity-50"
                                            >
                                                {isDisconnecting
                                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    : <LogOut className="w-3.5 h-3.5" />
                                                }
                                                Sair
                                            </button>
                                        ) : (
                                            <button
                                                onClick={handleConnect}
                                                disabled={isConnecting}
                                                className="flex items-center gap-1.5 text-xs font-semibold text-sky-400 hover:text-sky-300 bg-gray-900 px-3 py-1.5 rounded-lg border border-gray-600 transition-colors disabled:opacity-50"
                                            >
                                                {isConnecting
                                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    : <LogIn className="w-3.5 h-3.5" />
                                                }
                                                {isConnecting ? "Aguardando..." : "Conectar"}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            {!loading && !calendarConnected && !isConnecting && (
                                <div className="bg-gray-900/60 border border-gray-700 rounded-xl p-4 space-y-3">
                                    <div className="flex gap-2 text-amber-400 text-xs font-semibold">
                                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                                        Configuração necessária
                                    </div>
                                    <ol className="list-decimal list-inside space-y-2 text-xs text-gray-400 leading-relaxed">
                                        <li>
                                            No{" "}
                                            <a
                                                href="https://console.cloud.google.com/apis/credentials"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-sky-400 hover:underline inline-flex items-center gap-0.5"
                                            >
                                                Google Cloud Console <ExternalLink className="w-3 h-3" />
                                            </a>
                                            , ative a Google Calendar API e crie credenciais OAuth.
                                        </li>
                                        <li>
                                            Adicione a URI de redirecionamento:{" "}
                                            <code className="text-sky-300 bg-gray-900 px-1 py-0.5 rounded text-[10px]">{CAL_REDIRECT_URI}</code>
                                        </li>
                                        <li>
                                            Salve o JSON como <code className="text-gray-300">credentials.json</code> em <code className="text-gray-300">server/</code>.
                                        </li>
                                        <li>Reinicie o servidor e clique em "Conectar" acima.</li>
                                    </ol>
                                </div>
                            )}

                            {connectError && !isConnecting && (
                                <div className="flex items-start gap-2 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3">
                                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                    <span>{connectError}</span>
                                </div>
                            )}

                            {isConnecting && (
                                <div className="flex items-center gap-2 text-xs text-sky-300 bg-sky-500/10 border border-sky-500/20 rounded-xl p-3">
                                    <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                                    Aguardando autorização no navegador. Complete o login na janela que foi aberta.
                                </div>
                            )}
                        </section>
                    </div>
                </div>
            )}
        </>
    );
}
