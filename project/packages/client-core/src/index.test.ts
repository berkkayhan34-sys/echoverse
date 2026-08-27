/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { describe, expect, it } from "vitest";
import {
  SESSION_TOKEN_KEY,
  clearSessionToken,
  persistSession,
  readSessionToken,
  readStoredSession,
  writeSessionToken
} from "./index.js";

function storageFixture() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key)
  };
}

describe("browser-safe session adapter", () => {
  it("round-trips a session and removes it when cleared", () => {
    const storage = storageFixture();
    const session = {
      token: "token",
      account: { id: "account", email: "user@example.com", username: "user", avatarData: null }
    };

    persistSession(storage, session);
    expect(readStoredSession(storage)).toEqual(session);
    persistSession(storage, null);
    expect(readStoredSession(storage)).toBeNull();
  });

  it("rejects malformed or incomplete persisted state", () => {
    const storage = storageFixture();
    storage.setItem("echoverse-session", "not-json");
    expect(readStoredSession(storage)).toBeNull();
    storage.setItem("echoverse-session", JSON.stringify({ token: "token", account: {} }));
    expect(readStoredSession(storage)).toBeNull();
  });

  it("uses the shared token key adapter", () => {
    const storage = storageFixture();
    writeSessionToken(storage, "token");
    expect(SESSION_TOKEN_KEY).toBe("echoverse_token");
    expect(readSessionToken(storage)).toBe("token");
    clearSessionToken(storage);
    expect(readSessionToken(storage)).toBeNull();
  });
});
