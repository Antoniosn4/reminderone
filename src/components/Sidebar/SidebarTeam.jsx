// =============================================================
//  SidebarTeam.jsx
//  Item de equipe com avatares empilhados na sidebar.
// =============================================================

import { Users } from "lucide-react";
import { Avatar } from "../Avatar";

const MAX_VISIBLE_AVATARS = 3;
const SIDEBAR_AVATAR_SIZE_PX = 20;

/**
 * @param {{
 *   teamName: string,
 *   members: number,
 *   active?: boolean,
 *   onClick?: () => void
 * }} props
 */
export function SidebarTeam({ teamName, members, active = false, onClick }) {
    const visibleCount = Math.min(members, MAX_VISIBLE_AVATARS);
    const overflowCount = members - MAX_VISIBLE_AVATARS;

    return (
        <div
            onClick={onClick}
            className={`flex items-center justify-between px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${active
                ? "bg-gray-700 text-gray-100 shadow-sm"
                : "hover:bg-gray-700/50 text-gray-400 hover:text-gray-200"
                }`}
        >
            <div className="flex items-center gap-3">
                <Users className={`w-4 h-4 ${active ? "text-gray-100" : "text-gray-500"}`} />
                <span className="text-sm">{teamName}</span>
            </div>

            <div className="flex items-center -space-x-1.5">
                {Array.from({ length: visibleCount }).map((_, i) => (
                    <Avatar
                        key={i}
                        seed={`${teamName}-${i}`}
                        size={SIDEBAR_AVATAR_SIZE_PX}
                        className="border border-gray-800"
                    />
                ))}
                {overflowCount > 0 && (
                    <span className="w-5 h-5 rounded-full border border-gray-800 bg-gray-700 text-[8px] flex items-center justify-center font-bold">
                        +{overflowCount}
                    </span>
                )}
            </div>
        </div>
    );
}
