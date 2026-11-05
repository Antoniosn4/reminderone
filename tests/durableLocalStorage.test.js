import "fake-indexeddb/auto";
import { describe, it, expect, beforeAll } from "vitest";
import {
    installLocalStorageMirror,
    localStorageFlushed,
    restoreLocalStorage,
} from "../src/services/durableLocalStorage";
import { isVaultInitialized, setupVault, unlockVault } from "../src/services/vaultService";

// O WebView2 perde o localStorage num fechamento abrupto: simula sem passar pelo espelho.
const { clear: rawClear } = Storage.prototype;
const loseLocalStorage = () => rawClear.call(localStorage);

describe("durable localStorage mirror", () => {
    beforeAll(async () => {
        await restoreLocalStorage();
        installLocalStorageMirror();
    });

    it("keeps the vault (salt + canary) when localStorage is lost after setup", async () => {
        const key = await setupVault("1234");
        expect(key).toBeTruthy();

        loseLocalStorage();
        expect(isVaultInitialized()).toBe(false);

        await restoreLocalStorage();
        expect(isVaultInitialized()).toBe(true);
        expect(await unlockVault("1234")).toBeTruthy();
    });

    it("mirrors removals and leaves sessionStorage alone", async () => {
        localStorage.setItem("reminder-sync-key", "abc");
        sessionStorage.setItem("only-session", "1");
        localStorage.removeItem("reminder-sync-key");
        await localStorageFlushed();

        loseLocalStorage();
        await restoreLocalStorage();
        expect(localStorage.getItem("reminder-sync-key")).toBeNull();
        expect(localStorage.getItem("only-session")).toBeNull();
        expect(sessionStorage.getItem("only-session")).toBe("1");
    });
});
