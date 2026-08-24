// =============================================================
//  NoteEditor.jsx
//  Editor de blocos estilo Notion via @blocknote.
//  Renderiza o BlockNoteView com tema dark adaptado ao app.
//  Expõe o documento JSON via callback onChange a cada edição.
// =============================================================

import { useEffect, useMemo } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import "@blocknote/core/fonts/inter.css";

const DARK_THEME = {
    colors: {
        editor: {
            text: "rgb(228, 228, 231)",
            background: "transparent",
        },
        menu: {
            text: "rgb(228, 228, 231)",
            background: "rgb(24, 24, 27)",
        },
        tooltip: {
            text: "rgb(228, 228, 231)",
            background: "rgb(39, 39, 42)",
        },
        hovered: {
            text: "rgb(245, 245, 245)",
            background: "rgb(39, 39, 42)",
        },
        selected: {
            text: "rgb(245, 245, 245)",
            background: "rgba(139, 92, 246, 0.25)",
        },
        disabled: {
            text: "rgb(100, 100, 112)",
            background: "rgb(24, 24, 27)",
        },
        shadow: "rgba(0, 0, 0, 0.3)",
        border: "rgb(63, 63, 70)",
        sideMenu: "rgb(100, 100, 112)",
        highlights: {
            gray:    { text: "rgb(180, 180, 188)", background: "rgba(100, 100, 112, 0.3)" },
            brown:   { text: "rgb(180, 130, 100)", background: "rgba(120, 80, 50, 0.3)" },
            red:     { text: "rgb(248, 113, 113)", background: "rgba(239, 68, 68, 0.2)" },
            orange:  { text: "rgb(251, 146, 60)",  background: "rgba(249, 115, 22, 0.2)" },
            yellow:  { text: "rgb(250, 204, 21)",  background: "rgba(234, 179, 8, 0.2)" },
            green:   { text: "rgb(74, 222, 128)",   background: "rgba(34, 197, 94, 0.2)" },
            blue:    { text: "rgb(96, 165, 250)",   background: "rgba(59, 130, 246, 0.2)" },
            purple:  { text: "rgb(192, 132, 252)",  background: "rgba(139, 92, 246, 0.2)" },
            pink:    { text: "rgb(244, 114, 182)",  background: "rgba(236, 72, 153, 0.2)" },
        },
    },
    borderRadius: 8,
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
};

/**
 * @param {{
 *   initialBlocks?: Array | null,
 *   onChange?: (blocks: Array) => void,
 *   editable?: boolean,
 * }} props
 */
export function NoteEditor({ initialBlocks, onChange, editable = true }) {
    const initial = useMemo(
        () => (Array.isArray(initialBlocks) && initialBlocks.length > 0 ? initialBlocks : undefined),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );

    const editor = useCreateBlockNote({ initialContent: initial });

    useEffect(() => {
        if (!onChange) return;
        const unsubscribe = editor.onChange(() => {
            onChange(editor.document);
        });
        return unsubscribe;
    }, [editor, onChange]);

    return (
        <BlockNoteView
            editor={editor}
            theme={DARK_THEME}
            editable={editable}
            sideMenu={editable}
            formattingToolbar={editable}
            slashMenu={editable}
        />
    );
}
