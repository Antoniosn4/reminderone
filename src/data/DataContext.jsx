// =============================================================
//  DataContext.jsx
//  Abre o armazenamento de registros quando o cofre destrava,
//  importa (uma vez) os dados de antes e liga a sincronização.
//  Os hooks de domínio leem por `useCollection`.
// =============================================================

import { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";
import { useVault } from "../components/vault/VaultContext";
import { logger } from "../utils/logger";
import { createDataStore } from "./dataStore";
import { importLegacyData, legacySources } from "./legacyImport";
import { createIdbPersistence, createVaultCipher } from "./persistence";
import { createSyncController } from "./syncController";

const DataContext = createContext(null);

export function DataProvider({ children, createPersistence = createIdbPersistence }) {
    const { key } = useVault();
    const [state, setState] = useState({ store: null, sync: null, error: null });

    useEffect(() => {
        if (!key) return undefined;
        let cancelled = false;
        let controller = null;
        (async () => {
            try {
                // StrictMode (dev) monta, desmonta e monta de novo: a rodada
                // cancelada não pode importar os dados antigos em paralelo.
                const persistence = await createPersistence();
                if (cancelled) return;
                const store = createDataStore({ persistence, vaultCipher: createVaultCipher(key) });
                await store.load();
                if (cancelled) return;
                await importLegacyData(store, legacySources(key));
                if (cancelled) return;
                controller = createSyncController({ store, vaultKey: key });
                await controller.start();
                if (cancelled) controller.stop();
                else setState({ store, sync: controller, error: null });
            } catch (error) {
                logger.error("[data] falha ao abrir os dados:", error);
                if (!cancelled) setState({ store: null, sync: null, error });
            }
        })();
        return () => {
            cancelled = true;
            controller?.stop();
        };
    }, [key, createPersistence]);

    if (state.error) {
        return (
            <div className="h-screen flex items-center justify-center bg-gray-900 text-gray-300 p-8 text-center">
                Não foi possível abrir os dados locais. Feche e abra o app de novo.
            </div>
        );
    }
    if (!state.store) {
        return <div className="h-screen bg-gray-900" aria-busy="true" />;
    }
    return <DataContext.Provider value={state}><PersistenceNotice store={state.store} />{children}</DataContext.Provider>;
}

function PersistenceNotice({ store }) {
    const status = useSyncExternalStore(store.subscribePersistence, store.getPersistenceStatus);
    useEffect(() => {
        const beforeUnload = event => {
            if (store.getPersistenceStatus().state === 'saved') return;
            event.preventDefault();
            event.returnValue = '';
        };
        window.addEventListener('beforeunload', beforeUnload);
        return () => window.removeEventListener('beforeunload', beforeUnload);
    }, [store]);
    if (status.state === 'saved') return null;
    return <div role={status.state === 'error' ? 'alert' : 'status'} className="fixed bottom-4 right-4 z-[100] rounded-xl bg-gray-800 border border-gray-600 p-4 text-sm text-white shadow-xl">
        {status.state === 'saving' ? 'Salvando neste dispositivo…' : <>
            Não foi possível salvar. Mantenha o app aberto.
            {status.error?.message && <div className="mt-2 max-w-sm text-gray-300">{status.error.message}</div>}
            <button className="ml-3 text-blue-300 underline" onClick={() => store.retryPersistence().catch(() => undefined)}>Tentar novamente</button>
        </>}
    </div>;
}

export function useData() {
    const ctx = useContext(DataContext);
    if (!ctx) throw new Error("useData deve ser usado dentro de DataProvider");
    return ctx;
}

/** Os registros vivos de uma entidade; re-renderiza quando ela muda (aqui ou pelo celular). */
export function useCollection(entity) {
    const { store } = useData();
    return useSyncExternalStore(store.subscribe, () => store.list(entity));
}

/** Estado da sincronização para a tela de Configurações e a barra lateral. */
export function useSyncStatus() {
    const { sync } = useData();
    return useSyncExternalStore(sync.subscribe, sync.getStatus);
}

/** Para testes: injeta um store/controlador prontos sem IndexedDB nem cofre. */
export function TestDataProvider({ store, sync, children }) {
    return <DataContext.Provider value={{ store, sync, error: null }}>{children}</DataContext.Provider>;
}
