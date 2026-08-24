// =============================================================
//  RoutineModals.jsx
//  Modais de criação e edição de rotinas inteligentes.
//  Edição inclui confirmação antes de exclusão (ConfirmModal).
// =============================================================

import { useState, useEffect } from "react";
import { Clock, Settings, X, Trash2 } from "lucide-react";
import { renderIcon } from "../../constants/renderIcon";
import { ConfirmModal } from "./ConfirmModal";

const ICONS = ["Pill", "Droplet", "Clock", "Coffee", "Activity", "Code2", "CheckCircle2"];
const COLORS = ["text-violet-400", "text-rose-400", "text-cyan-400", "text-amber-400", "text-emerald-400", "text-blue-400"];

const HEX_FROM_TAILWIND = {
    "text-violet-400": "#a78bfa",
    "text-rose-400": "#fb7185",
    "text-cyan-400": "#22d3ee",
    "text-amber-400": "#fbbf24",
    "text-emerald-400": "#34d399",
    "text-blue-400": "#60a5fa",
};

// ── Criar Rotina ──

export function NewRoutineModal({ isOpen, onClose, onAddRoutine }) {
    const [label, setLabel] = useState("");
    const [time, setTime] = useState("08:00");
    const [icon, setIcon] = useState("CheckCircle2");
    const [color, setColor] = useState("text-indigo-400");

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!label.trim()) return;
        onAddRoutine({ label: label.trim(), time, icon, color });
        setLabel("");
        setTime("08:00");
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-gray-800 border border-gray-700 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden shadow-black/50" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-6 border-b border-gray-700 bg-gray-800/80">
                    <h2 className="text-lg font-bold text-gray-100 flex items-center gap-2"><Clock className="w-5 h-5 text-gray-400" /> Nova Rotina</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors p-1.5 rounded-lg hover:bg-gray-700"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-6 space-y-6">
                    <div>
                        <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Hábito / Tarefa Diária</label>
                        <input autoFocus type="text" value={label} onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSubmit(e)} className="w-full bg-gray-900 border border-gray-700 text-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gray-500 transition-all shadow-inner" placeholder="Ex: Alongamento" />
                    </div>
                    <div>
                        <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Horário</label>
                        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full bg-gray-900 border border-gray-700 text-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gray-500 transition-all shadow-inner [color-scheme:dark]" />
                    </div>
                    <div>
                        <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Estilo (Ícone & Cor)</label>
                        <div className="flex flex-col gap-3">
                            <div className="flex gap-2 flex-wrap bg-gray-900 p-2 rounded-xl border border-gray-700">
                                {ICONS.map((i) => (
                                    <div key={i} onClick={() => setIcon(i)} className={`p-2 rounded-lg cursor-pointer transition-colors ${icon === i ? "bg-gray-700" : "hover:bg-gray-800"}`}>
                                        {renderIcon(i, "w-5 h-5 text-gray-300")}
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-3 flex-wrap px-1">
                                {COLORS.map((c) => (
                                    <div key={c} onClick={() => setColor(c)} className={`w-6 h-6 rounded-full cursor-pointer transition-transform border-2 ${color === c ? "scale-125 border-white shadow-lg" : "border-transparent hover:scale-110"}`} style={{ backgroundColor: HEX_FROM_TAILWIND[c] || "#a78bfa" }} />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-700 bg-gray-800/80">
                    <button onClick={onClose} className="px-6 py-2.5 text-sm font-bold text-gray-300 hover:text-gray-100 hover:bg-gray-700 rounded-xl transition-all">Cancelar</button>
                    <button onClick={handleSubmit} className="px-6 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold rounded-xl transition-all shadow-md transform active:scale-95">Criar Rotina</button>
                </div>
            </div>
        </div>
    );
}

// ── Editar Rotina ──

export function EditRoutineModal({ routine, onClose, onSave, onDelete }) {
    const [label, setLabel] = useState(routine?.label || "");
    const [time, setTime] = useState(routine?.time || "08:00");
    const [icon, setIcon] = useState(routine?.icon || "CheckCircle2");
    const [color, setColor] = useState(routine?.color || "text-violet-400");
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // BUG-05 fix: re-hydrate fields when routine prop changes
    useEffect(() => {
        if (routine) {
            setLabel(routine.label || "");
            setTime(routine.time || "08:00");
            setIcon(routine.icon || "CheckCircle2");
            setColor(routine.color || "text-indigo-400");
        }
    }, [routine]);

    if (!routine) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!label.trim()) return;
        onSave(routine.id, { label: label.trim(), time, icon, color });
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-gray-800 border border-gray-700 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden shadow-black/50" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-6 border-b border-gray-700 bg-gray-800/80">
                    <h2 className="text-lg font-bold text-gray-100 flex items-center gap-2"><Settings className="w-5 h-5 text-gray-400" /> Editar Rotina</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors p-1.5 rounded-lg hover:bg-gray-700"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-6 space-y-6">
                    <div>
                        <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Hábito / Tarefa Diária</label>
                        <input autoFocus type="text" value={label} onChange={(e) => setLabel(e.target.value)} className="w-full bg-gray-900 border border-gray-700 text-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gray-500 transition-all shadow-inner" />
                    </div>
                    <div>
                        <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Horário</label>
                        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full bg-gray-900 border border-gray-700 text-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gray-500 transition-all shadow-inner [color-scheme:dark]" />
                    </div>
                    <div>
                        <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Estilo (Ícone & Cor)</label>
                        <div className="flex flex-col gap-3">
                            <div className="flex gap-2 flex-wrap bg-gray-900 p-2 rounded-xl border border-gray-700">
                                {ICONS.map((i) => (
                                    <div key={i} onClick={() => setIcon(i)} className={`p-2 rounded-lg cursor-pointer transition-colors ${icon === i ? "bg-gray-700" : "hover:bg-gray-800"}`}>
                                        {renderIcon(i, "w-5 h-5 text-gray-300")}
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-3 flex-wrap px-1">
                                {COLORS.map((c) => (
                                    <div key={c} onClick={() => setColor(c)} className={`w-6 h-6 rounded-full cursor-pointer transition-transform border-2 ${color === c ? "scale-125 border-white shadow-lg" : "border-transparent hover:scale-110"}`} style={{ backgroundColor: HEX_FROM_TAILWIND[c] || "#a78bfa" }} />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex items-center justify-between p-6 border-t border-gray-700 bg-gray-800/80">
                    <button onClick={() => setShowDeleteConfirm(true)} className="flex items-center gap-2 text-sm font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 px-4 py-2.5 rounded-xl transition-all"><Trash2 className="w-4 h-4" /> Excluir</button>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-6 py-2.5 text-sm font-bold text-gray-300 hover:text-gray-100 hover:bg-gray-700 rounded-xl transition-all">Cancelar</button>
                        <button onClick={handleSubmit} className="px-6 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold rounded-xl transition-all shadow-md transform active:scale-95">Salvar</button>
                    </div>
                </div>
            </div>

            <ConfirmModal
                isOpen={showDeleteConfirm}
                title={`Excluir rotina "${routine.label}"?`}
                description="O histórico de conclusão desta rotina será removido permanentemente. Esta ação não pode ser desfeita."
                confirmLabel="Sim, excluir"
                onConfirm={() => { setShowDeleteConfirm(false); onDelete(routine.id); }}
                onCancel={() => setShowDeleteConfirm(false)}
            />
        </div>
    );
}
