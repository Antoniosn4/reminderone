// =============================================================
//  SyncSection.jsx
//  Configurações › Sincronização com o celular: ativar, mostrar o
//  QR code de pareamento, sincronizar agora e desativar. Também
//  aceita o código de outro app deste PC (outro cofre) já pareado.
// =============================================================

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Smartphone, RefreshCw, Copy, Check, Power, AlertTriangle, Link2 } from "lucide-react";
import { useData, useSyncStatus } from "../../data/DataContext";
import { SyncHttpError } from "../../data/syncClient";
import { ConfirmModal } from "../modals/ConfirmModal";

function describe(status) {
    switch (status.state) {
        case "inactive":
            return "Desativada: os dados ficam só neste computador.";
        case "syncing":
            return "Sincronizando…";
        case "idle":
            return status.lastSyncAt
                ? `Sincronizado às ${new Date(status.lastSyncAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
                : "Ativa";
        case "error":
            return status.message;
        default:
            return "";
    }
}

function PairingCode({ sync }) {
    const [options, setOptions] = useState(null);
    const [selected, setSelected] = useState(0);
    const [qr, setQr] = useState(null);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;
        sync.pairingOptions().then(
            (loaded) => { if (!cancelled) setOptions(loaded); },
            () => { if (!cancelled) setError("Não foi possível ler os endereços de rede deste PC."); },
        );
        return () => { cancelled = true; };
    }, [sync]);

    const option = options?.[selected] ?? null;

    useEffect(() => {
        if (!option) return undefined;
        let cancelled = false;
        QRCode.toDataURL(option.code, { margin: 1, width: 220, color: { dark: "#000000", light: "#ffffff" } }).then(
            (url) => { if (!cancelled) setQr(url); },
            () => { if (!cancelled) setQr(null); },
        );
        return () => { cancelled = true; };
    }, [option]);

    if (error) return <p className="text-sm text-rose-400">{error}</p>;
    if (!options) return <p className="text-sm text-gray-500">Carregando o código…</p>;
    if (options.length === 0) {
        return <p className="text-sm text-amber-400">Este PC não está em nenhuma rede. Conecte ao Wi-Fi para parear o celular.</p>;
    }

    return (
        <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="bg-white rounded-xl p-2 w-[236px] h-[236px] flex items-center justify-center flex-shrink-0">
                {qr ? <img src={qr} alt="QR code de pareamento" width={220} height={220} /> : null}
            </div>
            <div className="space-y-3 min-w-0">
                <p className="text-sm text-gray-300">
                    No celular: <strong>Configurações › Sincronização com o desktop › Ler QR code</strong>. O celular
                    precisa estar na mesma rede (ou na mesma VPN) que este computador.
                </p>
                {options.length > 1 && (
                    <div>
                        <p className="text-xs text-gray-500 mb-1.5">Endereço deste PC que o celular vai usar:</p>
                        <div className="flex flex-wrap gap-2">
                            {options.map((item, index) => (
                                <button
                                    key={item.address}
                                    onClick={() => setSelected(index)}
                                    className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                                        index === selected ? "border-sky-500 text-sky-400 bg-sky-500/10" : "border-gray-600 text-gray-400 hover:text-gray-200"
                                    }`}
                                >
                                    {item.address}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                <div>
                    <p className="text-xs text-gray-500 mb-1.5">Ou copie o código e cole no celular:</p>
                    <div className="flex items-center gap-2">
                        <code className="text-[11px] text-gray-400 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 break-all max-w-[420px]">
                            {option.code}
                        </code>
                        <button
                            onClick={() => {
                                void navigator.clipboard?.writeText(option.code);
                                setCopied(true);
                                setTimeout(() => setCopied(false), 2000);
                            }}
                            title="Copiar código"
                            className="p-2 rounded-lg text-gray-400 hover:text-gray-100 hover:bg-gray-700 flex-shrink-0"
                        >
                            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        </button>
                    </div>
                </div>
                <p className="text-xs text-gray-500">
                    O código contém a chave que cifra seus dados: mostre só para os seus aparelhos.
                </p>
            </div>
        </div>
    );
}

export function SyncSection() {
    const { sync } = useData();
    const status = useSyncStatus();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [conflict, setConflict] = useState(false);
    const [joinCode, setJoinCode] = useState("");
    const [confirm, setConfirm] = useState(null);

    const active = status.state !== "inactive";

    async function run(work) {
        setBusy(true);
        setError(null);
        try {
            await work();
            return true;
        } catch (caught) {
            if (caught instanceof SyncHttpError && caught.kind === "conflict") {
                setConflict(true);
            } else {
                setError(caught?.message ?? "Falha ao configurar a sincronização.");
            }
            return false;
        } finally {
            setBusy(false);
        }
    }

    return (
        <section className="bg-gray-800 border border-gray-700 rounded-2xl p-6 shadow-xl">
            <h2 className="text-sm font-semibold text-gray-200 mb-1 flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-gray-400" /> Sincronização com o celular
            </h2>
            <p className="text-xs text-gray-500 mb-5">
                Tarefas, projetos, Kanban, anotações, rotinas e perfil iguais nos dois apps, sem nuvem: este computador
                é o servidor. Tudo é cifrado com a chave do pareamento; o servidor guarda só dados cifrados.
            </p>

            <div className="flex items-center gap-2 mb-5">
                <span
                    className={`w-2.5 h-2.5 rounded-full ${
                        status.state === "error" ? "bg-rose-500" : status.state === "inactive" ? "bg-gray-500" : "bg-emerald-500"
                    } ${status.state === "syncing" ? "animate-pulse" : ""}`}
                />
                <span className={`text-sm ${status.state === "error" ? "text-rose-400" : "text-gray-300"}`}>{describe(status)}</span>
            </div>

            {error && <p className="text-sm text-rose-400 mb-4">{error}</p>}

            {!active && !conflict && (
                <div className="space-y-4">
                    <button
                        onClick={() => void run(() => sync.enable())}
                        disabled={busy}
                        className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
                    >
                        <Smartphone className="w-4 h-4" /> Ativar sincronização
                    </button>
                </div>
            )}

            {!active && conflict && (
                <div className="space-y-4 border border-amber-500/30 bg-amber-500/5 rounded-xl p-4">
                    <p className="text-sm text-amber-300 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        O servidor deste PC já está sincronizando com outra chave (de outro app aberto aqui, como a
                        versão instalada). Para usar os mesmos dados, cole o código mostrado lá. Ou redefina o servidor:
                        os aparelhos pareados terão que parear de novo.
                    </p>
                    <div className="flex gap-2">
                        <input
                            value={joinCode}
                            onChange={(e) => setJoinCode(e.target.value)}
                            placeholder="reminder-sync:v1:…"
                            aria-label="Código de pareamento"
                            className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-100 outline-none focus:border-gray-500"
                        />
                        <button
                            onClick={() => void run(() => sync.joinWithCode(joinCode)).then((ok) => { if (ok) { setConflict(false); setJoinCode(""); } })}
                            disabled={busy || !joinCode.trim()}
                            className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-xl"
                        >
                            <Link2 className="w-4 h-4" /> Usar código
                        </button>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setConfirm("reset")}
                            disabled={busy}
                            className="text-sm text-rose-400 border border-rose-500/40 hover:bg-rose-500/10 px-4 py-2 rounded-xl"
                        >
                            Redefinir o servidor
                        </button>
                        <button onClick={() => setConflict(false)} className="text-sm text-gray-400 hover:text-gray-200 px-3 py-2">
                            Cancelar
                        </button>
                    </div>
                </div>
            )}

            {active && (
                <div className="space-y-6">
                    <PairingCode sync={sync} />
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => void sync.syncNow()}
                            className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-gray-100 text-sm font-semibold px-4 py-2 rounded-xl"
                        >
                            <RefreshCw className={`w-4 h-4 ${status.state === "syncing" ? "animate-spin" : ""}`} /> Sincronizar agora
                        </button>
                        <button
                            onClick={() => setConfirm("disable")}
                            className="flex items-center gap-2 text-rose-400 border border-rose-500/40 hover:bg-rose-500/10 text-sm font-semibold px-4 py-2 rounded-xl"
                        >
                            <Power className="w-4 h-4" /> Desativar sincronização
                        </button>
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={confirm !== null}
                title={confirm === "reset" ? "Redefinir o servidor?" : "Desativar a sincronização?"}
                description={
                    confirm === "reset"
                        ? "O servidor esquece a chave antiga e os dados cifrados com ela. Este app passa a sincronizar com uma chave nova, e os celulares precisam parear de novo."
                        : "O servidor deste PC apaga os dados cifrados e esquece a chave. Os dados continuam neste app e nos celulares, mas param de sincronizar."
                }
                confirmLabel={confirm === "reset" ? "Redefinir" : "Desativar"}
                variant="danger"
                onConfirm={() => {
                    const action = confirm;
                    setConfirm(null);
                    if (action === "reset") {
                        void run(() => sync.enable({ resetServer: true })).then((ok) => { if (ok) setConflict(false); });
                    } else {
                        void run(() => sync.disable());
                    }
                }}
                onCancel={() => setConfirm(null)}
            />
        </section>
    );
}
