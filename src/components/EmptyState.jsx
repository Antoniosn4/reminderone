// =============================================================
//  EmptyState.jsx
//  Componente reutilizável para listas vazias.
//  Centraliza o visual e a mensagem de "nada por aqui ainda"
//  para manter consistência entre views.
// =============================================================

/**
 * @param {{
 *   icon: import("lucide-react").LucideIcon,
 *   title: string,
 *   description?: string,
 *   action?: { label: string, onClick: () => void },
 * }} props
 */
export function EmptyState({ icon: Icon, title, description, action }) {
    return (
        <div className="flex flex-col items-center justify-center text-center py-16 px-6 animate-in fade-in duration-300">
            <div className="w-16 h-16 rounded-2xl bg-gray-800 border border-gray-700 flex items-center justify-center mb-5 shadow-inner">
                <Icon className="w-7 h-7 text-gray-500" aria-hidden="true" />
            </div>
            <h3 className="text-lg font-bold text-gray-200 mb-2">{title}</h3>
            {description && (
                <p className="text-sm text-gray-500 max-w-sm leading-relaxed mb-6">
                    {description}
                </p>
            )}
            {action && (
                <button
                    type="button"
                    onClick={action.onClick}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 text-sm font-semibold transition-colors"
                >
                    {action.label}
                </button>
            )}
        </div>
    );
}
