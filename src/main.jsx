import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { VaultProvider } from "./components/vault/VaultContext.jsx";
import { VaultGate } from "./components/vault/VaultGate.jsx";
import { ErrorBoundary } from "./components/ErrorBoundary.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
        <ErrorBoundary>
            <VaultProvider>
                <VaultGate>
                    <App />
                </VaultGate>
            </VaultProvider>
        </ErrorBoundary>
    </React.StrictMode>,
);
