// =============================================================
//  useMention.js
//  Custom Hook — Lógica de @mention: detecção, menu e inserção.
//  Refatorado para usar equipes dinâmicas (sem MOCK_TEAM).
// =============================================================

import { useState, useCallback } from "react";

/**
 * Extrai o membro da equipe mencionado em uma string de texto.
 * Retorna o primeiro match encontrado, ou null.
 *
 * @param {string} text
 * @param {Array<{id: string, name: string}>} [members] - Lista de membros mencionáveis
 * @returns {{ id: string, name: string } | null}
 */
export function extractMentionedMember(text, members = []) {
    if (!text || members.length === 0) return null;
    return (
        members.find((member) =>
            text.toLowerCase().includes(`@${member.name.toLowerCase()}`)
        ) ?? null
    );
}

/**
 * Hook que gerencia o estado e as ações do menu de @mention.
 *
 * @param {string} inputValue - Valor atual do input.
 * @param {(value: string) => void} setInputValue - Setter do input.
 * @param {React.RefObject<HTMLInputElement>} inputRef
 */
export function useMention(inputValue, setInputValue, inputRef) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    /** Deve ser chamado no onChange do input para detectar o símbolo @. */
    const handleInputChange = useCallback(
        (newValue) => {
            setInputValue(newValue);
            setIsMenuOpen(newValue.includes("@"));
        },
        [setInputValue]
    );

    /** Insere a menção no input e fecha o menu. */
    const selectMember = useCallback(
        (member) => {
            const withMention = inputValue.replace(/@\w*$/, `@${member.name} `);
            setInputValue(withMention);
            setIsMenuOpen(false);
            inputRef.current?.focus();
        },
        [inputValue, setInputValue, inputRef]
    );

    const closeMenu = useCallback(() => setIsMenuOpen(false), []);

    return { isMenuOpen, handleInputChange, selectMember, closeMenu };
}
