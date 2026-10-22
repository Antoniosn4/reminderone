// =============================================================
//  useProjects.test.jsx
//  Cobre o CRUD de projetos e sub-projetos sobre o armazenamento de
//  registros (sincronizado), incluindo duplicados (case-insensitive)
//  e a ida das tarefas para a Entrada quando o projeto sai.
// =============================================================

import { describe, it, expect } from "vitest";
import { act } from "@testing-library/react";
import { useProjects } from "../src/hooks/useProjects";
import { renderDataHook } from "./support/renderWithData";

async function setup() {
    return renderDataHook(() => useProjects());
}

describe("useProjects", () => {
    it("começa sem projetos (sem os exemplos de antes)", async () => {
        const { result } = await setup();
        expect(result.current.projects).toEqual([]);
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

    it("excluir projeto exclui os subprojetos e manda as tarefas para a Entrada", async () => {
        const { result, store } = await setup();
        act(() => result.current.addProject({ label: "Viagem" }));
        const parent = result.current.projects.at(-1);
        act(() => result.current.addSubProject(parent.id, "Passagens"));
        const sub = result.current.projects.at(-1).subProjects[0];
        act(() => {
            store.write("task", "t1", { title: "Comprar passagem", projectId: sub.id });
        });

        act(() => result.current.removeProject(parent.id));

        expect(result.current.projects).toEqual([]);
        expect(store.get("project", sub.id)).toBeNull();
        expect(store.get("task", "t1").projectId).toBe("inbox");
    });
});
