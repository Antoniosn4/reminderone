// =============================================================
//  TeamModals.jsx
//  Modais de criação e edição de equipes.
//  Edição inclui confirmação antes de exclusão (ConfirmModal).
// =============================================================

import { useState } from "react";
import { Users, Settings, X, Trash2 } from "lucide-react";
import { ConfirmModal } from "./ConfirmModal";

// ── Criar Equipe ──

export function NewTeamModal({ isOpen, onClose, onAddTeam }) {
    const [name, setName] = useState("");
    const [members, setMembers] = useState(2);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onAddTeam({ name: name.trim(), members: Number(members) });
        setName("");
        setMembers(2);
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-gray-800 border border-gray-700 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden shadow-black/50" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-6 border-b border-gray-700 bg-gray-800/80">
                    <h2 className="text-lg font-bold text-gray-100 flex items-center gap-2"><Users className="w-5 h-5 text-gray-400" /> Nova Equipe</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors p-1.5 rounded-lg hover:bg-gray-700"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-6 space-y-6">
                    <div>
                        <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Nome da Equipe</label>
                        <input autoFocus type="text" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSubmit(e)} className="w-full bg-gray-900 border border-gray-700 text-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gray-500 transition-all shadow-inner" placeholder="Ex: Produto & Design" />
                    </div>
                    <div>
                        <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Número de Membros</label>
                        <input type="number" min="1" max="50" value={members} onChange={(e) => setMembers(e.target.value)} className="w-full bg-gray-900 border border-gray-700 text-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gray-500 transition-all shadow-inner" />
                    </div>
                </div>
                <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-700 bg-gray-800/80">
                    <button onClick={onClose} className="px-6 py-2.5 text-sm font-bold text-gray-300 hover:text-gray-100 hover:bg-gray-700 rounded-xl transition-all">Cancelar</button>
                    <button onClick={handleSubmit} className="px-6 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold rounded-xl transition-all shadow-md transform active:scale-95">Criar Equipe</button>
                </div>
            </div>
        </div>
    );
}

// ── Editar Equipe ──

export function EditTeamModal({ team, onClose, onSave, onDelete }) {
    const [name, setName] = useState(team?.name || "");
    const [members, setMembers] = useState(team?.members || 2);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    if (!team) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onSave(team.id, { name: name.trim(), members: Number(members) });
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-gray-800 border border-gray-700 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden shadow-black/50" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-6 border-b border-gray-700 bg-gray-800/80">
                    <h2 className="text-lg font-bold text-gray-100 flex items-center gap-2"><Settings className="w-5 h-5 text-gray-400" /> Editar Equipe</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors p-1.5 rounded-lg hover:bg-gray-700"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-6 space-y-6">
                    <div>
                        <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Nome da Equipe</label>
                        <input autoFocus type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-gray-900 border border-gray-700 text-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gray-500 transition-all shadow-inner" />
                    </div>
                    <div>
                        <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Número de Membros</label>
                        <input type="number" min="1" max="50" value={members} onChange={(e) => setMembers(e.target.value)} className="w-full bg-gray-900 border border-gray-700 text-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gray-500 transition-all shadow-inner" />
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
                title={`Excluir equipe "${team.name}"?`}
                description="Todas as tarefas associadas a esta equipe perderão a referência. Esta ação não pode ser desfeita."
                confirmLabel="Sim, excluir"
                onConfirm={() => { setShowDeleteConfirm(false); onDelete(team.id); }}
                onCancel={() => setShowDeleteConfirm(false)}
            />
        </div>
    );
}
