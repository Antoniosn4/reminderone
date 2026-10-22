// =============================================================
//  taskModals.test.jsx
//  Os modais de tarefa ficam sempre montados (AppModals) e só
//  aparecem quando recebem isOpen/task. Abrir não pode mudar a
//  quantidade de hooks entre renders — era o que derrubava o app
//  com "Rendered more hooks than during the previous render".
// =============================================================

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TaskCreateModal } from "../src/components/modals/TaskCreateModal";
import { TaskEditModal } from "../src/components/modals/TaskEditModal";
import { createTask } from "../src/constants/taskSchema";

const PROJECTS = [{ id: "frontend", label: "Frontend", color: "#3b82f6", subProjects: [] }];

describe("TaskCreateModal", () => {
    it("abre e fecha sem quebrar a ordem dos hooks", () => {
        const props = { onClose: vi.fn(), onSave: vi.fn(), projects: PROJECTS };
        const view = render(<TaskCreateModal isOpen={false} {...props} />);
        expect(screen.queryByText("Nova Tarefa")).not.toBeInTheDocument();

        view.rerender(<TaskCreateModal isOpen {...props} />);
        expect(screen.getByText("Nova Tarefa")).toBeInTheDocument();

        view.rerender(<TaskCreateModal isOpen={false} {...props} />);
        expect(screen.queryByText("Nova Tarefa")).not.toBeInTheDocument();
    });
});

describe("TaskEditModal", () => {
    it("abre ao receber uma tarefa e fecha quando ela sai", () => {
        const props = { onClose: vi.fn(), onSave: vi.fn(), onDelete: vi.fn(), projects: PROJECTS };
        const task = createTask({ title: "Revisar o relatório" });
        const view = render(<TaskEditModal task={null} {...props} />);
        expect(screen.queryByText("Detalhes da Tarefa")).not.toBeInTheDocument();

        view.rerender(<TaskEditModal task={task} {...props} />);
        expect(screen.getByText("Detalhes da Tarefa")).toBeInTheDocument();

        view.rerender(<TaskEditModal task={null} {...props} />);
        expect(screen.queryByText("Detalhes da Tarefa")).not.toBeInTheDocument();
    });
});
