// =============================================================
//  VaultGate.jsx
//  Roteador binário entre a tela de autenticação e o app.
//  Renderiza AuthScreen quando o vault está travado ou não criado;
//  libera os children quando está destravado.
// =============================================================

import { useVault, VAULT_STATUS } from "./VaultContext";
import { AuthScreen } from "./AuthScreen";

export function VaultGate({ children }) {
    const { status } = useVault();

    if (status === VAULT_STATUS.LOADING) return null;
    if (status === VAULT_STATUS.UNLOCKED) return children;
    return <AuthScreen />;
}
