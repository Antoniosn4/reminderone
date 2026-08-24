// =============================================================
//  geminiService.js
//  Camada de integração com a API Gemini via proxy local.
//
//  SEGURANÇA: A chave de API pode ser:
//    1. Configurada pelo usuário via UI (salva criptografada no vault)
//    2. Definida em server/.env (fallback)
//  A chave é enviada via header X-Gemini-Key ao proxy local,
//  que a repassa via x-goog-api-key ao Google (nunca na URL).
//
//  TIMEOUT: 5s por tentativa — se o servidor local não está rodando,
//  falha rapidamente. Máximo 2 tentativas (≤10s no pior caso).
// =============================================================

import { logger } from "../utils/logger";
import { apiUrl } from "./apiBase";

const LOCAL_API_PATH = "/api/gemini";
const FETCH_TIMEOUT_MS = 5_000;   // 5s por tentativa
const MAX_RETRIES = 2;        // 1 tentativa + 1 retry = falha em ≤10s
const RETRY_DELAY_MS = 1_000;   // 1s entre tentativas

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ── Gemini Key cache ──
// A chave é carregada do vault e cacheada em memória para
// enviar ao proxy em cada request. Nunca persiste em plaintext.
let _cachedGeminiKey = "";

/**
 * Define a chave Gemini para uso nas próximas chamadas.
 * Chamado pelo App/hook após desbloquear o vault.
 * @param {string} key
 */
export function setGeminiApiKey(key) {
    _cachedGeminiKey = key || "";
}

/**
 * Cria um fetch com timeout controlado por AbortController.
 * Se o servidor local não responder em FETCH_TIMEOUT_MS, aborta.
 */
async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

/**
 * Envia um prompt para a API Gemini via proxy local e retorna a resposta parseada.
 * Falha rapidamente (≤10s) se o servidor estiver offline.
 * Retorna null em caso de falha total (nunca lança exceção).
 *
 * @param {string} prompt - O prompt de texto.
 * @param {object} schema - O JSON Schema da resposta.
 * @returns {Promise<object|null>}
 */
export async function callGemini(prompt, schema) {
  const requestBody = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: schema,
    },
  };

  // Monta headers — inclui a chave do vault se disponível
  const headers = { "Content-Type": "application/json" };
  if (_cachedGeminiKey) {
    headers["X-Gemini-Key"] = _cachedGeminiKey;
  }

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetchWithTimeout(apiUrl(LOCAL_API_PATH), {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return JSON.parse(data.candidates[0].content.parts[0].text);

    } catch (error) {
      const isLast = attempt === MAX_RETRIES;
      if (isLast) {
        logger.warn(
          `[geminiService] Falha após ${MAX_RETRIES} tentativa(s). ` +
          "Verifique se server/main.py está rodando.",
          error?.message ?? error
        );
        return null;
      }
      await sleep(RETRY_DELAY_MS);
    }
  }

  return null;
}
