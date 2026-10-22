// =============================================================
//  mappers.test.js
//  Duração estimada: o Gemini devolve 0 quando o comando não fala
//  de duração, e a tarefa aparecia com um "0" solto na lista.
// =============================================================

import { describe, it, expect } from "vitest";
import { desktopTaskChanges } from "../src/data/mappers";

const duration = (value) =>
    desktopTaskChanges({ estimatedDuration: value }, { resolveProjectId: () => "inbox" }).estimatedDuration;

describe("desktopTaskChanges › estimatedDuration", () => {
    it("guarda minutos positivos", () => {
        expect(duration(30)).toBe(30);
        expect(duration("45")).toBe(45);
    });

    it("0, vazio, null e texto viram sem duração", () => {
        expect(duration(0)).toBeNull();
        expect(duration("")).toBeNull();
        expect(duration(null)).toBeNull();
        expect(duration("meia hora")).toBeNull();
    });
});
