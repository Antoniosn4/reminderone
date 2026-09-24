// =============================================================
//  MainContent.jsx
//  Componente de roteamento de views — renderiza a view ativa
//  dentro do painel principal. Extrai toda a lógica de view routing
//  que antes estava inline em App.jsx.
// =============================================================

import {
    BarChart2, CheckCircle2, Star, History,
    AlertCircle, Calendar, StickyNote, KanbanSquare,
    PlusCircle,
} from "lucide-react";

import { useAppContext } from "../contexts/AppContext";

// Components
import { SmartInput } from "./SmartInput";
import { MentionMenu } from "./MentionMenu";
import { TaskItem } from "./TaskList/TaskItem";
import { AccountButton } from "./AccountButton";

// Views
import { CalendarView } from "./views/CalendarView";
import { SettingsView } from "./views/SettingsView";
import { PrioritiesView } from "./views/PrioritiesView";
import { HistoryView } from "./views/HistoryView";
// GenericTeamView removed — Teams feature not in v0.1.0
import { GenericRoutineView } from "./views/GenericRoutineView";
import { NotesView } from "./views/NotesView";
import { KanbanView } from "./views/KanbanView";

function resolveHeaderIcon(activeView, routines) {
    if (activeView === "ideias_produto") return <Star className="w-8 h-8 text-yellow-500" />;
    if (activeView === "historico") return <History className="w-8 h-8 text-emerald-500" />;
    if (activeView === "prioridades") return <AlertCircle className="w-8 h-8 text-rose-500" />;
    if (activeView === "calendario") return <Calendar className="w-8 h-8 text-indigo-400" />;
    if (activeView === "anotacoes") return <StickyNote className="w-8 h-8 text-amber-400" />;
    if (activeView === "kanban") return <KanbanSquare className="w-8 h-8 text-indigo-400" />;
    return null;
}

export function MainContent() {
    const ctx = useAppContext();
    const {
        activeView, viewTitle, viewType,
        routines, tasks, themeCtx,
        // Input
        inputRef, inputValue, handleInputChange, handleSubmit,
        // Voice
        isRecording, isTranscribing, isAnalyzing, elapsedTime, toggleRecording, cancelRecording, mediaStream,
        // Mention
        isMenuOpen, mentionableMembers, selectMember,
        // Tasks
        pendingTasks, completedTasks, taskHandlers,
        // Calendar
        handleResyncCalendar, isResyncing, setSelectedCalendarDate,
        // Notes
        notes, toggleNoteCompletion, setEditingNote, setIsNoteModalOpen,
        // Kanban
        kanbanBoard, kanbanActions,
        // Routines
        toggleRoutineToday,
        // UI
        setShowWeeklyReport,
        // Helpers
        getFormattedDate,
    } = ctx;

    const handleNoteDelete = ctx.handleNoteDelete;

    return (
        <main className="flex-1 flex flex-col relative overflow-hidden bg-gray-900">

            {/* ── Header ── */}
            <header className="px-10 pt-12 pb-6 flex items-end justify-between max-w-5xl mx-auto w-full flex-shrink-0">
                <div>
                    <h1 className="text-4xl font-extrabold text-gray-100 tracking-tight flex items-center gap-3">
                        {resolveHeaderIcon(activeView, routines)}
                        {viewTitle}
                        {activeView === "hoje" && (
                            <span className="text-sm font-medium text-gray-400 bg-gray-800 px-3 py-1 rounded-full mt-2 border border-gray-700">
                                {getFormattedDate()}
                            </span>
                        )}
                        {activeView === "settings" && (
                            <span className="text-sm font-medium text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full mt-2 border border-indigo-500/20">
                                Pro
                            </span>
                        )}
                    </h1>
                </div>
                <div className="flex items-center gap-3">
                    {activeView !== "settings" && !activeView.startsWith("routine_") && (
                        <>
                            <button
                                onClick={() => ctx.setIsCreateTaskOpen(true)}
                                className="flex items-center gap-2 text-xs font-semibold text-emerald-400 bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg border border-gray-700 transition-colors"
                            >
                                <PlusCircle className="w-4 h-4" /> Nova Tarefa
                            </button>
                            <button
                                onClick={() => setShowWeeklyReport(true)}
                                className="flex items-center gap-2 text-xs font-semibold text-indigo-400 bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg border border-gray-700 transition-colors"
                            >
                                <BarChart2 className="w-4 h-4" /> Resumo
                            </button>
                        </>
                    )}
                    <AccountButton onResyncCalendar={handleResyncCalendar} isResyncing={isResyncing} />
                </div>
            </header>

            {/* ── View Router ── */}

            {viewType === "standard" && (
                <div className="flex-1 flex flex-col overflow-hidden w-full max-w-5xl mx-auto">
                    <div className="px-10 pb-6 w-full z-30 relative">
                        <SmartInput
                            inputRef={inputRef}
                            value={inputValue}
                            isRecording={isRecording}
                            isTranscribing={isTranscribing}
                            isAnalyzing={isAnalyzing}
                            elapsedTime={elapsedTime}
                            mediaStream={mediaStream}
                            onChange={handleInputChange}
                            onSubmit={handleSubmit}
                            onToggleRecording={toggleRecording}
                            onCancelRecording={cancelRecording}
                        >
                            <MentionMenu isOpen={isMenuOpen} members={mentionableMembers} onSelect={selectMember} />
                        </SmartInput>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar px-10 pb-20">
                        <div className="space-y-3">
                            {pendingTasks.length === 0 ? (
                                <div className="text-center py-12 text-gray-500 flex flex-col items-center">
                                    <CheckCircle2 className="w-12 h-12 mb-3 opacity-20" />
                                    <p>Tudo limpo por aqui. Aproveite o momento!</p>
                                </div>
                            ) : (
                                pendingTasks.map((task) => (
                                    <TaskItem key={task.id} task={task} {...taskHandlers} />
                                ))
                            )}
                        </div>
                        {completedTasks.length > 0 && (
                            <div className="mt-10">
                                <h3 className="text-sm font-semibold text-gray-500 border-b border-gray-800 pb-2 mb-4">
                                    Concluídas
                                </h3>
                                <div className="space-y-3 opacity-60 hover:opacity-100 transition-opacity duration-500">
                                    {completedTasks.map((task) => (
                                        <TaskItem key={task.id} task={task} {...taskHandlers} />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {viewType === "priorities" && (
                <div className="flex-1 overflow-y-auto custom-scrollbar px-10 pb-20 w-full max-w-5xl mx-auto">
                    <PrioritiesView tasks={tasks} {...taskHandlers} />
                </div>
            )}

            {viewType === "calendar" && (
                <div className="flex-1 overflow-y-auto custom-scrollbar px-10 pb-20 w-full max-w-5xl mx-auto">
                    <CalendarView tasks={tasks} onDayClick={setSelectedCalendarDate} />
                </div>
            )}

            {viewType === "history" && (
                <div className="flex-1 overflow-y-auto custom-scrollbar px-10 pb-20 w-full max-w-5xl mx-auto">
                    <HistoryView tasks={tasks} {...taskHandlers} />
                </div>
            )}

            {viewType === "settings" && (
                <div className="flex-1 overflow-y-auto custom-scrollbar px-10 pb-20 w-full max-w-5xl mx-auto">
                    <SettingsView theme={themeCtx.theme} onThemeChange={themeCtx.setTheme} />
                </div>
            )}

            {viewType === "routine" && (() => {
                const routine = routines.find((r) => r.id === activeView);
                return (
                    <div className="flex-1 overflow-y-auto custom-scrollbar px-10 pb-20 w-full max-w-5xl mx-auto">
                        <GenericRoutineView routine={routine} onToggleToday={toggleRoutineToday} />
                    </div>
                );
            })()}

            {viewType === "kanban" && (
                <div className="flex-1 overflow-hidden px-6 pb-6 w-full">
                    <KanbanView board={kanbanBoard} actions={kanbanActions} />
                </div>
            )}

            {viewType === "notes" && (
                <div className="flex-1 overflow-y-auto custom-scrollbar px-10 pb-20 w-full">
                    <NotesView
                        notes={notes}
                        onAdd={() => { setEditingNote(null); setIsNoteModalOpen(true); }}
                        onEdit={(note) => { setEditingNote(note); setIsNoteModalOpen(true); }}
                        onDelete={handleNoteDelete}
                        onToggle={toggleNoteCompletion}
                    />
                </div>
            )}

        </main>
    );
}
