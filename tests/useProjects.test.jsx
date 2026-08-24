// =============================================================
//  useProjects.test.jsx
//  Cobre o pipeline CRUD de projetos e sub-projetos, incluindo
//  detecção de duplicados (case-insensitive) e idempotência.
//  Mocks isolam a camada cifrada para que o teste não dependa
//  do WebCrypto nem do VaultContext.
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

import { useProjects } from "../src/hooks/useProjects";

async function setup() {
    const view = renderHook(() => useProjects());
    // Aguarda hidratação assíncrona do usePersistedState.
    await waitFor(() => expect(view.result.current.projects.length).toBeGreaterThan(0));
    return view;
}

describe("useProjects", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("adiciona um novo projeto com label e cor padrão", async () => {
        const { result } = await setup();
        const before = result.current.projects.length;

        act(() => result.current.addProject({ label: "Fisioterapia" }));
        expect(result.current.projects).toHaveLength(before + 1);
        const created = result.current.projects[before];
        expect(created.label).toBe("Fisioterapia");
        expect(created.color).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it("ignora duplicatas case-insensitive", async () => {
        const { result } = await setup();
        act(() => result.current.addProject({ label: "Único" }));
        const after1 = result.current.projects.length;
        act(() => result.current.addProject({ label: "ÚNICO" }));
        expect(result.current.projects).toHaveLength(after1);
    });

    it("ignora label vazia ou apenas com espaços", async () => {
        const { result } = await setup();
        const before = result.current.projects.length;
        act(() => result.current.addProject({ label: "   " }));
        act(() => result.current.addProject({ label: "" }));
        expect(result.current.projects).toHaveLength(before);
    });

    it("renomeia projeto existente", async () => {
        const { result } = await setup();
        act(() => result.current.addProject({ label: "Saude" }));
        const target = result.current.projects.at(-1);
        act(() => result.current.updateProject(target.id, { label: "Saúde" }));
        const updated = result.current.projects.find((p) => p.id === target.id);
        expect(updated.label).toBe("Saúde");
    });

    it("remove projeto pelo id", async () => {
        const { result } = await setup();
        act(() => result.current.addProject({ label: "Temporário" }));
        const target = result.current.projects.at(-1);
        act(() => result.current.removeProject(target.id));
        expect(result.current.projects.find((p) => p.id === target.id)).toBeUndefined();
    });

    it("adiciona sub-projeto sem permitir duplicata", async () => {
        const { result } = await setup();
        act(() => result.current.addProject({ label: "Estudos" }));
        const parent = result.current.projects.at(-1);

        act(() => result.current.addSubProject(parent.id, "Cálculo"));
        act(() => result.current.addSubProject(parent.id, "cálculo"));

        const refreshed = result.current.projects.find((p) => p.id === parent.id);
        expect(refreshed.subProjects).toHaveLength(1);
        expect(refreshed.subProjects[0].label).toBe("Cálculo");
    });

    it("renomeia e remove sub-projeto", async () => {
        const { result } = await setup();
        act(() => result.current.addProject({ label: "Trabalho" }));
        const parent = result.current.projects.at(-1);
        act(() => result.current.addSubProject(parent.id, "Backlog"));
        const sub = result.current.projects
            .find((p) => p.id === parent.id)
            .subProjects.at(-1);

        act(() => result.current.updateSubProject(parent.id, sub.id, { label: "Sprint atual" }));
        const renamed = result.current.projects
            .find((p) => p.id === parent.id)
            .subProjects.find((s) => s.id === sub.id);
        expect(renamed.label).toBe("Sprint atual");

        act(() => result.current.removeSubProject(parent.id, sub.id));
        const after = result.current.projects.find((p) => p.id === parent.id).subProjects;
        expect(after.find((s) => s.id === sub.id)).toBeUndefined();
    });
});
