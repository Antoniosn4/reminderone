// =============================================================
//  SidebarProjectFolder.jsx
//  Pasta de projeto expansível com sub-projetos aninhados.
//  Botão "Configurar" aparece no hover e dispara onEdit(project).
// =============================================================

import React from "react";
import { ChevronRight, ChevronDown, Hash, MoreHorizontal } from "lucide-react";

/**
 * @param {{
 *   color: string,
 *   label: string,
 *   isExpanded: boolean,
 *   onToggle: () => void,
 *   onRoute: () => void,
 *   onEdit?: () => void,
 *   active: boolean,
 *   children?: React.ReactNode
 * }} props
 */
export function SidebarProjectFolder({
    color,
    label,
    isExpanded,
    onToggle,
    onRoute,
    onEdit,
    active,
    children,
}) {
    const hasChildren = React.Children.count(children) > 0;

    return (
        <div className="mb-0.5 group/folder">
            <div
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                    active
                        ? "bg-gray-700/80 text-gray-100 shadow-sm ring-1 ring-gray-600/50"
                        : "hover:bg-gray-700/40 text-gray-400 hover:text-gray-200"
                }`}
            >
                <div
                    onClick={(event) => {
                        event.stopPropagation();
                        if (hasChildren) onToggle();
                    }}
                    className={`flex items-center justify-center w-5 h-5 rounded-md transition-colors ${
                        hasChildren
                            ? "hover:bg-gray-600/80 cursor-pointer"
                            : "opacity-0 cursor-default"
                    }`}
                >
                    {hasChildren
                        ? isExpanded
                            ? <ChevronDown className="w-3.5 h-3.5" />
                            : <ChevronRight className="w-3.5 h-3.5" />
                        : null}
                </div>

                <div className="flex items-center gap-2 flex-1 min-w-0" onClick={onRoute}>
                    <Hash className="w-4 h-4 flex-shrink-0" style={{ color }} />
                    <span className="text-[14px] font-medium truncate select-none leading-none pt-[1px]">
                        {label}
                    </span>
                </div>

                {onEdit && (
                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation();
                            onEdit();
                        }}
                        title="Editar projeto"
                        aria-label={`Editar projeto ${label}`}
                        className="opacity-0 group-hover/folder:opacity-100 focus:opacity-100 flex items-center justify-center w-6 h-6 rounded-md text-gray-400 hover:text-gray-100 hover:bg-gray-600/70 transition-opacity"
                    >
                        <MoreHorizontal className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>

            <div
                className={`grid transition-all duration-300 ease-out ${
                    isExpanded && hasChildren
                        ? "grid-rows-[1fr] opacity-100 mt-0.5"
                        : "grid-rows-[0fr] opacity-0"
                }`}
            >
                <div className="overflow-hidden">
                    <div className="ml-[18px] pl-3.5 border-l-[1.5px] border-gray-700/60 space-y-0.5 py-1">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * @param {{ label: string, active: boolean, onClick: () => void }} props
 */
export function SidebarSubProject({ label, active, onClick }) {
    return (
        <div
            onClick={onClick}
            className={`group flex items-center gap-2.5 px-3 py-1.5 rounded-lg cursor-pointer transition-colors select-none ${
                active
                    ? "bg-gray-700/60 text-gray-100 shadow-sm ring-1 ring-gray-600/30"
                    : "text-gray-400 hover:text-gray-200 hover:bg-gray-700/30"
            }`}
        >
            <div
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                    active ? "bg-indigo-400" : "bg-gray-600 group-hover:bg-gray-500"
                }`}
            />
            <span className="text-[13px] font-medium leading-none pt-[1px]">{label}</span>
        </div>
    );
}
