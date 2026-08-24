// =============================================================
//  VaultLayout.jsx
//  Wrapper visual da tela de autenticação. Centraliza branding
//  (logo ReminderONE), título contextual, card translúcido e
//  rodapé opcional.
//
//  Estrutura semântica (header / main / footer) para acessibilidade
//  e leitores de tela.
// =============================================================

const LOGO_URL = "/logonova.png";
const LOGO_ALT = "ReminderONE";

/**
 * @param {{
 *   title: string,
 *   subtitle: string,
 *   children: React.ReactNode,
 *   footer?: React.ReactNode,
 * }} props
 */
export function VaultLayout({ title, subtitle, children, footer }) {
    return (
        <div className="min-h-screen bg-gray-900 text-gray-200 font-sans flex items-center justify-center relative overflow-hidden">
            <div className="w-full max-w-[420px] p-6 z-10 animate-vault-in">

                <header className="flex flex-col items-center text-center mb-8">
                    <div className="w-28 h-28 rounded-3xl overflow-hidden shadow-lg mb-6">
                        <img
                            src={LOGO_URL}
                            alt={LOGO_ALT}
                            className="w-full h-full object-cover"
                            draggable={false}
                        />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-100 tracking-tight">
                        {title}
                    </h1>
                    <p className="text-sm text-gray-500 mt-2">
                        {subtitle}
                    </p>
                </header>

                <main className="bg-gray-800/40 backdrop-blur-sm border border-gray-700/60 rounded-3xl p-8 shadow-2xl shadow-black/20">
                    {children}
                </main>

                {footer && (
                    <footer className="mt-8 text-center text-sm text-gray-500">
                        {footer}
                    </footer>
                )}

            </div>
        </div>
    );
}
