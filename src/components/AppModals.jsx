// =============================================================
//  AppModals.jsx
//  Todos os modais globais do app, renderizados como portais fixos.
//  Lê state/handlers inteiramente do AppContext.
// =============================================================

import { Toaster } from "react-hot-toast";
import { useAppContext } from "../contexts/AppContext";

// Modals
import { SearchModal } from "./SearchModal";
import { QuickAddModal } from "./QuickAddModal";
import { SmartInput } from "./SmartInput";
import { MentionMenu } from "./MentionMenu";
import { TaskEditModal } from "./modals/TaskEditModal";
import { TaskCreateModal } from "./modals/TaskCreateModal";
import { NewProjectModal, EditProjectModal } from "./modals/ProjectModals";
// TeamModals removed — Teams feature not in v0.1.0
import { NewRoutineModal, EditRoutineModal } from "./modals/RoutineModals";
import { CalendarDayModal } from "./modals/CalendarDayModal";
import { NoteModal } from "./modals/NoteModal";

export function AppModals() {
    const ctx = useAppContext();

    return (
        <>
            <QuickAddModal
                isOpen={ctx.isQuickAddOpen}
                onClose={() => ctx.setIsQuickAddOpen(false)}
                inputRef={ctx.inputRef}
                inputValue={ctx.inputValue}
                isRecording={ctx.isRecording}
                isTranscribing={ctx.isTranscribing}
                isAnalyzing={ctx.isAnalyzing}
                elapsedTime={ctx.elapsedTime}
                mediaStream={ctx.mediaStream}
                onChange={ctx.handleInputChange}
                onSubmit={ctx.handleSubmit}
                onToggleRecording={ctx.toggleRecording}
                onCancelRecording={ctx.cancelRecording}
            >
                <MentionMenu isOpen={ctx.isMenuOpen} members={ctx.mentionableMembers} onSelect={ctx.selectMember} />
            </QuickAddModal>

            <SearchModal isOpen={ctx.isSearchOpen} onClose={() => ctx.setIsSearchOpen(false)} tasks={ctx.tasks} onNavigate={ctx.navigate} />

            {/* Task Edit */}
            <TaskEditModal
                task={ctx.editingTask}
                onClose={() => ctx.setEditingTask(null)}
                onSave={ctx.handleTaskEditSave}
                onDelete={ctx.handleTaskEditDelete}
                projects={ctx.projects}
                onCreateNewProject={() => ctx.setIsNewProjectOpen(true)}
            />

            {/* Task Create */}
            <TaskCreateModal
                isOpen={ctx.isCreateTaskOpen}
                onClose={() => ctx.setIsCreateTaskOpen(false)}
                onSave={ctx.handleTaskCreate}
                projects={ctx.projects}
                onCreateNewProject={() => ctx.setIsNewProjectOpen(true)}
            />

            {/* Project Modals */}
            <NewProjectModal
                isOpen={ctx.isNewProjectOpen}
                onClose={() => ctx.setIsNewProjectOpen(false)}
                onAddProject={ctx.handleNewProject}
            />
            <EditProjectModal
                project={
                    ctx.editingProject
                        ? ctx.projects.find((p) => p.id === ctx.editingProject.id) ?? ctx.editingProject
                        : null
                }
                onClose={() => ctx.setEditingProject(null)}
                onSave={ctx.handleEditProjectSave}
                onDelete={ctx.handleDeleteProject}
                onAddSubProject={ctx.addSubProject}
                onUpdateSubProject={ctx.updateSubProject}
                onRemoveSubProject={ctx.removeSubProject}
            />


            {/* Routine Modals */}
            <NewRoutineModal
                isOpen={ctx.isNewRoutineOpen}
                onClose={() => ctx.setIsNewRoutineOpen(false)}
                onAddRoutine={ctx.handleNewRoutine}
            />
            <EditRoutineModal
                routine={ctx.editingRoutine}
                onClose={() => ctx.setEditingRoutine(null)}
                onSave={ctx.handleEditRoutineSave}
                onDelete={ctx.handleDeleteRoutine}
            />

            {/* Calendar Day Modal */}
            <CalendarDayModal
                date={ctx.selectedCalendarDate}
                tasks={ctx.tasks}
                onClose={() => ctx.setSelectedCalendarDate(null)}
                {...ctx.taskHandlers}
            />

            {/* Note Modal */}
            <NoteModal
                isOpen={ctx.isNoteModalOpen}
                note={ctx.editingNote}
                onClose={ctx.handleNoteModalClose}
                onSave={ctx.handleNoteSave}
            />

            {/* Toast notifications */}
            <Toaster
                position="bottom-right"
                toastOptions={{
                    style: {
                        background: "rgb(var(--gray-800))",
                        color: "rgb(var(--gray-200))",
                        border: "1px solid rgb(var(--gray-700))",
                    },
                    error: {
                        iconTheme: {
                            primary: "#f87171",
                            secondary: "rgb(var(--gray-800))",
                        },
                    },
                }}
            />

        </>
    );
}
