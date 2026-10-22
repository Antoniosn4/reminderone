// =============================================================
//  useRoutines.test.jsx
//  Garante o ciclo de vida das rotinas: add, update, delete e
//  toggleRoutineToday gravando `completedDates` (dia local).
// =============================================================

import { describe, it, expect } from "vitest";
import { act } from "@testing-library/react";
import { useRoutines } from "../src/hooks/useRoutines";
import { localDateISO } from "../src/data/mappers";
import { renderDataHook } from "./support/renderWithData";

const TODAY_ISO = localDateISO();

async function setup() {
    return renderDataHook(() => useRoutines());
}

describe("useRoutines", () => {
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
