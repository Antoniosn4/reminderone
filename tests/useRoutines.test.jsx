// =============================================================
//  useRoutines.test.jsx
//  Garante o ciclo de vida das rotinas: add, update, delete e
//  toggleRoutineToday persistindo `completedDates` corretamente.
// =============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

vi.mock("../src/components/vault/VaultContext", () => ({
    useVault: () => ({ key: { fake: true } }),
}));

vi.mock("../src/services/secureLocalStorage", () => ({
    readEncrypted: vi.fn(async (_key, _storageKey, fallback) => fallback),
    writeEncrypted: vi.fn(async () => {}),
}));

import { useRoutines } from "../src/hooks/useRoutines";

const TODAY_ISO = new Date().toISOString().split("T")[0];

async function setup() {
    const view = renderHook(() => useRoutines());
    // Hook hidrata para [] por padrão; aguarda o estado sincronizar.
    await waitFor(() => expect(Array.isArray(view.result.current.routines)).toBe(true));
    return view;
}

describe("useRoutines", () => {
    beforeEach(() => vi.clearAllMocks());

    it("começa vazio (sem rotinas mockadas)", async () => {
        const { result } = await setup();
        expect(result.current.routines).toEqual([]);
    });

    it("adiciona uma rotina com defaults", async () => {
        const { result } = await setup();
        act(() => result.current.addRoutine({ label: "Meditar" }));
        expect(result.current.routines).toHaveLength(1);
        expect(result.current.routines[0]).toMatchObject({
            label: "Meditar",
            time: "08:00",
        });
    });

    it("ignora rotina com label vazia", async () => {
        const { result } = await setup();
        act(() => result.current.addRoutine({ label: " " }));
        expect(result.current.routines).toHaveLength(0);
    });

    it("toggleRoutineToday adiciona e remove a data de hoje", async () => {
        const { result } = await setup();
        act(() => result.current.addRoutine({ label: "Caminhar" }));
        const id = result.current.routines[0].id;

        act(() => result.current.toggleRoutineToday(id));
        expect(result.current.routines[0].completedDates).toContain(TODAY_ISO);

        act(() => result.current.toggleRoutineToday(id));
        expect(result.current.routines[0].completedDates ?? []).not.toContain(TODAY_ISO);
    });

    it("deleteRoutine remove a rotina pelo id", async () => {
        const { result } = await setup();
        act(() => result.current.addRoutine({ label: "Ler" }));
        const id = result.current.routines[0].id;
        act(() => result.current.deleteRoutine(id));
        expect(result.current.routines).toHaveLength(0);
    });
});
