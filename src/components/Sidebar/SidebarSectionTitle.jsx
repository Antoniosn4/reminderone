// =============================================================
//  SidebarSectionTitle.jsx
//  Cabeçalho de seção da sidebar com botão + opcional.
// =============================================================

import { Plus } from "lucide-react";

/**
 * @param {{ title: string, onAdd?: () => void }} props
 */
export function SidebarSectionTitle({ title, onAdd }) {
    return (
        <div
            className={`flex items-center justify-between px-3 mb-2 ${onAdd ? "group cursor-pointer" : ""}`}
            onClick={onAdd}
        >
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider group-hover:text-gray-400 transition-colors">
                {title}
            </h4>
            {onAdd && (
                <div className="p-1 hover:bg-gray-700 rounded-md opacity-0 group-hover:opacity-100 transition-all">
                    <Plus className="w-4 h-4 text-gray-400 hover:text-gray-200" />
                </div>
            )}
        </div>
    );
}
