// =============================================================
//  App.jsx
//  Componente raiz — composição pura da UI.
//  Toda a lógica de negócio, estado e handlers está em AppContext.
//  Toda a renderização de views está em MainContent.
//  Todos os modais estão em AppModals.
//
//  Responsabilidades:
//    1. Prover o AppContext
//    2. Compor Sidebar + MainContent + AppModals
// =============================================================

import { Sidebar } from "./components/Sidebar/Sidebar";
import { MainContent } from "./components/MainContent";
import { AppModals } from "./components/AppModals";
import { AppProvider, useAppContext } from "./contexts/AppContext";

function AppShell() {
    const {
        activeView, navigate,
        isRecording, toggleRecording,
        inboxCount,
        projects, routines,
        setIsQuickAddOpen, setIsSearchOpen,
        setIsNewProjectOpen, setEditingProject,
        setIsNewRoutineOpen,
    } = useAppContext();

    return (
        <div className="flex h-screen bg-gray-900 text-gray-200 font-sans overflow-hidden selection:bg-indigo-500/30">

            <Sidebar
                activeView={activeView}
                onNavigate={navigate}
                isRecording={isRecording}
                onToggleRecording={toggleRecording}
                onQuickAdd={() => setIsQuickAddOpen(true)}
                onSearch={() => setIsSearchOpen(true)}
                taskCount={inboxCount}
                projects={projects}
                routines={routines}
                onAddProject={() => setIsNewProjectOpen(true)}
                onEditProject={(project) => setEditingProject(project)}
                onAddRoutine={() => setIsNewRoutineOpen(true)}
            />

            <MainContent />

            <AppModals />

        </div>
    );
}

export default function App() {
    return (
        <AppProvider>
            <AppShell />
        </AppProvider>
    );
}
