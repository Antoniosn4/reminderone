// =============================================================
//  useKeyboardShortcuts.test.jsx
//  Verifica que o hook ignora atalhos enquanto o usuário digita
//  em campos de texto e dispara os handlers corretamente caso
//  contrário.
// =============================================================

import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { useKeyboardShortcuts } from "../src/hooks/useKeyboardShortcuts";

function Harness({ shortcuts }) {
    useKeyboardShortcuts(shortcuts);
    return (
        <div>
            <input data-testid="text-input" />
        </div>
    );
}

describe("useKeyboardShortcuts", () => {
    it("dispara handler para combo registrado", () => {
        const handler = vi.fn();
        render(<Harness shortcuts={[{ combo: "mod+k", handler }]} />);

        fireEvent.keyDown(window, { key: "k", ctrlKey: true });
        expect(handler).toHaveBeenCalledTimes(1);
    });

    it("ignora combos não registrados", () => {
        const handler = vi.fn();
        render(<Harness shortcuts={[{ combo: "mod+k", handler }]} />);

        fireEvent.keyDown(window, { key: "j", ctrlKey: true });
        expect(handler).not.toHaveBeenCalled();
    });

    it("não dispara quando o foco está em um <input> (a menos que allowInInput)", () => {
        const handler = vi.fn();
        const { getByTestId } = render(
            <Harness shortcuts={[{ combo: "mod+k", handler }]} />,
        );
        const input = getByTestId("text-input");
        input.focus();

        fireEvent.keyDown(input, { key: "k", ctrlKey: true });
        expect(handler).not.toHaveBeenCalled();
    });

    it("dispara em <input> quando allowInInput=true", () => {
        const handler = vi.fn();
        const { getByTestId } = render(
            <Harness shortcuts={[{ combo: "mod+k", handler, allowInInput: true }]} />,
        );
        const input = getByTestId("text-input");
        input.focus();

        fireEvent.keyDown(input, { key: "k", ctrlKey: true });
        expect(handler).toHaveBeenCalledTimes(1);
    });
});
