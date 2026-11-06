import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { VaultProvider } from "./components/vault/VaultContext.jsx";
import { VaultGate } from "./components/vault/VaultGate.jsx";
import { ErrorBoundary } from "./components/ErrorBoundary.jsx";
import { DataProvider } from "./data/DataContext.jsx";
import "./index.css";
import { installLocalStorageMirror, restoreLocalStorage } from "./services/durableLocalStorage";

// O cofre (salt do PIN) e a chave de sync vivem no localStorage, que o
// WebView2 pode perder num fechamento abrupto: restaura antes de montar.
restoreLocalStorage().finally(() => {
    installLocalStorageMirror();
    ReactDOM.createRoot(document.getElementById("root")).render(
        <React.StrictMode>
            <ErrorBoundary>
                <VaultProvider>
                    <VaultGate>
                        <DataProvider>
                            <App />
                        </DataProvider>
                    </VaultGate>
                </VaultProvider>
            </ErrorBoundary>
        </React.StrictMode>,
    );
});
