// =============================================================
//  id.test.js — generateId() preserva unicidade.
// =============================================================

import { describe, it, expect } from "vitest";
import { generateId } from "../src/utils/id";

describe("generateId", () => {
    it("gera identificador não-vazio", () => {
        expect(generateId()).toEqual(expect.any(String));
        expect(generateId().length).toBeGreaterThan(0);
    });

    it("é único em rajadas grandes", () => {
        const ids = Array.from({ length: 5_000 }, () => generateId());
        expect(new Set(ids).size).toBe(ids.length);
    });
});
