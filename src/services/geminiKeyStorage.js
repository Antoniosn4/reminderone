import { readEncrypted, writeEncrypted } from "./secureLocalStorage";

const GEMINI_KEY_STORAGE_KEY = "reminder-gemini-key";

export async function loadGeminiKey(key) {
    const data = await readEncrypted(key, GEMINI_KEY_STORAGE_KEY, null);
    return data?.apiKey ?? "";
}

export async function saveGeminiKey(key, apiKey) {
    await writeEncrypted(key, GEMINI_KEY_STORAGE_KEY, { apiKey });
}
