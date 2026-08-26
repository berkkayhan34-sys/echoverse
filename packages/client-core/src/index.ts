/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

export type SessionAccount = { id: string; email: string; username: string; avatarData: string | null };
export type Session = { token: string; account: SessionAccount };

export function readStoredSession(storage: Pick<Storage, "getItem">, key = "echoverse-session"): Session | null {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Session>;
    if (typeof parsed.token !== "string" || !parsed.account || typeof parsed.account.id !== "string") return null;
    return parsed as Session;
  } catch {
    return null;
  }
}

export function persistSession(storage: Pick<Storage, "setItem" | "removeItem">, session: Session | null, key = "echoverse-session") {
  if (!session) storage.removeItem(key);
  else storage.setItem(key, JSON.stringify(session));
}

export const SESSION_TOKEN_KEY = "echoverse_token";

export function readSessionToken(storage: Pick<Storage, "getItem">) {
  return storage.getItem(SESSION_TOKEN_KEY);
}

export function clearSessionToken(storage: Pick<Storage, "removeItem">) {
  storage.removeItem(SESSION_TOKEN_KEY);
}

export function writeSessionToken(storage: Pick<Storage, "setItem">, token: string) {
  storage.setItem(SESSION_TOKEN_KEY, token);
}
