// =============================================================
//  renderWithData.jsx
//  Renderiza hooks dentro de um DataProvider de teste, com o
//  armazenamento em memória (sem IndexedDB nem cofre).
// =============================================================

import { renderHook } from "@testing-library/react";
import { TestDataProvider } from "../../src/data/DataContext";
import { openStore } from "./syncKit";

const inactiveSync = {
    subscribe: () => () => {},
    getStatus: () => ({ state: "inactive" }),
};

export function renderDataHook(hook, store = openStore()) {
    const wrapper = ({ children }) => (
        <TestDataProvider store={store} sync={inactiveSync}>
            {children}
        </TestDataProvider>
    );
    return { store, ...renderHook(hook, { wrapper }) };
}
