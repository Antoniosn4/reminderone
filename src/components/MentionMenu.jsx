// =============================================================
//  MentionMenu.jsx
//  Menu flutuante de @mention com lista dinâmica de membros.
//  Usa os nomes de equipe cadastrados pelo usuário (useTeams).
// =============================================================

import { Avatar } from "./Avatar";

const AVATAR_SIZE_PX = 20;

/**
 * @param {{
 *   isOpen: boolean,
 *   members: Array<{id: string, name: string}>,
 *   onSelect: (member: {id: string, name: string}) => void,
 * }} props
 */
export function MentionMenu({ isOpen, members = [], onSelect }) {
    if (!isOpen || members.length === 0) return null;

    return (
        <div className="absolute top-full left-14 mt-2 w-56 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl p-1.5 z-40">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider px-2 py-1">
                Equipe
            </p>
            {members.map((member) => (
                <button
                    key={member.id}
                    type="button"
                    onClick={() => onSelect(member)}
                    className="w-full flex items-center gap-2 p-2 hover:bg-gray-700 rounded-lg cursor-pointer transition-colors text-left"
                >
                    <Avatar name={member.name} size={AVATAR_SIZE_PX} />
                    <span className="text-gray-200 text-sm font-medium">{member.name}</span>
                </button>
            ))}
        </div>
    );
}
