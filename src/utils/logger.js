// =============================================================
//  logger.js
//  Wrapper de console que silencia logs em builds de produção.
//  Evita vazamento de detalhes técnicos, prompts e payloads para
//  o console de usuários finais (DevTools / process logs do
//  Tauri/Electron).
// =============================================================

const isDev = (() => {
    try {
        return Boolean(import.meta.env?.DEV);
    } catch {
        return false;
    }
})();

function noop() { }

export const logger = {
    debug: isDev ? console.debug.bind(console) : noop,
    info: isDev ? console.info.bind(console) : noop,
    warn: isDev ? console.warn.bind(console) : noop,
    error: isDev ? console.error.bind(console) : noop,
};
