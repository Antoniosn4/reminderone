import React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("ErrorBoundary capturou um erro:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-gray-200 p-6 text-center">
                    <AlertCircle className="w-16 h-16 text-red-500 mb-6" />
                    <h1 className="text-3xl font-bold text-gray-100 mb-2">Ops! Algo deu errado.</h1>
                    <p className="text-gray-400 max-w-md mb-8 leading-relaxed">
                        O aplicativo encontrou um erro inesperado e precisou ser interrompido. 
                        Tente recarregar a interface.
                    </p>
                    
                    <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 w-full max-w-lg mb-8 overflow-auto text-left">
                        <code className="text-sm text-red-400 font-mono whitespace-pre-wrap">
                            {this.state.error?.toString()}
                        </code>
                    </div>

                    <button
                        onClick={() => window.location.reload()}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-semibold transition-all shadow-lg"
                    >
                        <RefreshCw className="w-5 h-5" />
                        Recarregar Aplicativo
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
