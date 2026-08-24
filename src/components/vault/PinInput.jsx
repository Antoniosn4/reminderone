// =============================================================
//  PinInput.jsx
//  Input de PIN de 4 dígitos com campos individuais.
//  Cada dígito é masked (•) por padrão.
//  Auto-advance entre campos e suporte a backspace/paste.
// =============================================================

import { useRef, useCallback } from "react";

const PIN_LENGTH = 4;

export function PinInput({ value, onChange, disabled = false, error = false, autoFocus = false }) {
    const inputsRef = useRef([]);

    const focusAt = useCallback((index) => {
        const clamped = Math.max(0, Math.min(index, PIN_LENGTH - 1));
        inputsRef.current[clamped]?.focus();
    }, []);

    const updateDigit = useCallback((index, digit) => {
        const next = value.split("");
        while (next.length < PIN_LENGTH) next.push("");
        next[index] = digit;
        onChange(next.join(""));
    }, [value, onChange]);

    const handleInput = useCallback((index, e) => {
        const char = e.target.value.replace(/\D/g, "").slice(-1);
        if (!char) return;
        updateDigit(index, char);
        if (index < PIN_LENGTH - 1) focusAt(index + 1);
    }, [updateDigit, focusAt]);

    const handleKeyDown = useCallback((index, e) => {
        if (e.key === "Backspace") {
            e.preventDefault();
            if (value[index]) {
                updateDigit(index, "");
            } else if (index > 0) {
                updateDigit(index - 1, "");
                focusAt(index - 1);
            }
        } else if (e.key === "ArrowLeft" && index > 0) {
            focusAt(index - 1);
        } else if (e.key === "ArrowRight" && index < PIN_LENGTH - 1) {
            focusAt(index + 1);
        }
    }, [value, updateDigit, focusAt]);

    const handlePaste = useCallback((e) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, PIN_LENGTH);
        if (!pasted) return;
        const padded = pasted.padEnd(PIN_LENGTH, "").slice(0, PIN_LENGTH);
        onChange(padded);
        focusAt(Math.min(pasted.length, PIN_LENGTH - 1));
    }, [onChange, focusAt]);

    const borderColor = error
        ? "border-red-500/60 focus:border-red-500 focus:ring-red-500/40"
        : "border-gray-700 focus:border-gray-500 focus:ring-gray-500";

    return (
        <div className="flex items-center justify-center gap-3" onPaste={handlePaste}>
            {Array.from({ length: PIN_LENGTH }, (_, i) => (
                <input
                    key={i}
                    ref={(el) => { inputsRef.current[i] = el; }}
                    type="password"
                    inputMode="numeric"
                    maxLength={1}
                    value={value[i] ?? ""}
                    onChange={(e) => handleInput(i, e)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    onFocus={(e) => e.target.select()}
                    disabled={disabled}
                    autoFocus={autoFocus && i === 0}
                    autoComplete="off"
                    aria-label={`Dígito ${i + 1} do PIN`}
                    className={`w-14 h-16 bg-gray-900/80 ${borderColor} border text-gray-100 rounded-xl text-center text-2xl font-bold focus:outline-none focus:ring-1 transition-all shadow-inner disabled:opacity-50 caret-transparent`}
                />
            ))}
        </div>
    );
}

export { PIN_LENGTH };
