// =============================================================
//  SidebarItem.jsx
//  Item de navegação genérico da sidebar.
// =============================================================

import React from "react";

/**
 * @param {{ icon: React.ReactElement, label: string, badge?: string|number, active?: boolean, textColor?: string, onClick?: () => void }} props
 */
export function SidebarItem({ icon, label, badge, active, textColor = "text-gray-300", onClick }) {
    return (
        <div
            onClick={onClick}
            className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors
        ${active ? "bg-gray-700 text-gray-100" : `hover:bg-gray-700/50 ${textColor}`}
      `}
        >
            <div className="flex items-center gap-3">
                <div className={`flex-shrink-0 flex items-center justify-center w-4 h-4 ${active ? "text-gray-100" : "text-gray-400"}`}>
                    {React.cloneElement(icon, { className: "w-4 h-4" })}
                </div>
                <span className="text-sm font-medium">{label}</span>
            </div>

            {badge && (
                <span className="text-xs font-bold text-gray-300 bg-gray-900 border border-gray-700 px-2 py-0.5 rounded-full">
                    {badge}
                </span>
            )}
        </div>
    );
}
