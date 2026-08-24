// =============================================================
//  ConfirmModal.jsx
//  Modal de confirmação reutilizável para ações destrutivas.
//  Exibe título, descrição contextual e botões "Cancelar" / "Confirmar".
//
//  Uso:
//    <ConfirmModal
//      isOpen={showConfirm}
//      title="Excluir Projeto"
//      description='O projeto "Faculdade" será removido permanentemente.'
//      confirmLabel="Sim, excluir"
//      onConfirm={() => deleteProject(id)}
//      onCancel={() => setShowConfirm(false)}
//    />
//
//  Design: mesmo padrão visual dos outros modais do app
//  (glassmorphism, rounded-3xl, violet accent).
// =============================================================

import { useCallback, useEffect, useRef } from "react";
import { AlertTriangle, X } from "lucide-react";

/**
 * @param {{
 *   isOpen: boolean,
 *   title: string,
 *   description?: string,
 *   confirmLabel?: string,
 *   cancelLabel?: string,
 *   variant?: "danger" | "warning",
 *   onConfirm: () => void,
 *   onCancel: () => void,
 * }} props
 */
export function ConfirmModal({
    isOpen,
    title,
    description = "Esta ação não pode ser desfeita.",
    confirmLabel = "Confirmar",
    cancelLabel = "Cancelar",
    variant = "danger",
    onConfirm,
    onCancel,
}) {
    const confirmRef = useRef(null);

    // Focus no botão de cancelar ao abrir (UX segura — evita confirmação acidental)
    useEffect(() => {
        if (isOpen) {
            // Delay para garantir que o modal está renderizado
            const timer = setTimeout(() => confirmRef.current?.focus(), 100);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    // Fechar com Escape
    const handleKeyDown = useCallback(
        (e) => {
            if (e.key === "Escape") onCancel();
        },
        [onCancel],
    );

    useEffect(() => {
        if (!isOpen) return;
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, handleKeyDown]);

    if (!isOpen) return null;

    const isDanger = variant === "danger";
    const iconColor = isDanger ? "text-rose-400" : "text-amber-400";
    const iconBg = isDanger ? "bg-rose-500/10" : "bg-amber-500/10";
    const btnBg = isDanger
        ? "bg-rose-500 hover:bg-rose-600 shadow-rose-500/30"
        : "bg-amber-500 hover:bg-amber-600 shadow-amber-500/30";

    return (
        <div
            className="fixed inset-0 bg-black/60 z-[80] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={onCancel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-modal-title"
        >
            <div
                className="bg-gray-800 border border-gray-700 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden shadow-black/50 animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start justify-between p-6 pb-0">
                    <div className={`p-3 rounded-2xl ${iconBg}`}>
                        <AlertTriangle className={`w-6 h-6 ${iconColor}`} />
                    </div>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="text-gray-500 hover:text-gray-300 transition-colors p-1.5 rounded-lg hover:bg-gray-700"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 pt-4 pb-2">
                    <h2
                        id="confirm-modal-title"
                        className="text-lg font-bold text-gray-100 mb-2"
                    >
                        {title}
                    </h2>
                    {description && (
                        <p className="text-sm text-gray-400 leading-relaxed">
                            {description}
                        </p>
                    )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 p-6 pt-4">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-5 py-2.5 text-sm font-bold text-gray-300 hover:text-gray-100 hover:bg-gray-700 rounded-xl transition-all"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        ref={confirmRef}
                        type="button"
                        onClick={onConfirm}
                        className={`px-5 py-2.5 text-sm font-bold text-white rounded-xl transition-all shadow-lg transform active:scale-95 ${btnBg}`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
