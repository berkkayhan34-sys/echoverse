/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { PROTOCOL_VERSION, resolveLocale, type Account, type Locale } from "@echoverse/contracts";

export type SessionAccount = Account;
export type Session = { token: string; account: SessionAccount };

export function readStoredSession(
  storage: Pick<Storage, "getItem">,
  key = "echoverse-session"
): Session | null {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Session>;
    if (
      typeof parsed.token !== "string" ||
      !parsed.account ||
      typeof parsed.account.id !== "string"
    )
      return null;
    return parsed as Session;
  } catch {
    return null;
  }
}

export function persistSession(
  storage: Pick<Storage, "setItem" | "removeItem">,
  session: Session | null,
  key = "echoverse-session"
) {
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

export const LOCALE_STORAGE_KEY = "echoverse_locale";
export const USERNAME_STORAGE_KEY = "echoverse_username";

export function readClientLocale(storage: Pick<Storage, "getItem">, browserLocale: string): Locale {
  return resolveLocale(storage.getItem(LOCALE_STORAGE_KEY) || browserLocale);
}

export function resolveClientLocale(value: string): Locale {
  return resolveLocale(value);
}

export function writeClientLocale(storage: Pick<Storage, "setItem">, locale: Locale) {
  storage.setItem(LOCALE_STORAGE_KEY, locale);
}

export function readStoredUsername(storage: Pick<Storage, "getItem">) {
  return storage.getItem(USERNAME_STORAGE_KEY) || "";
}

export function writeStoredUsername(storage: Pick<Storage, "setItem">, username: string) {
  storage.setItem(USERNAME_STORAGE_KEY, username);
}

export function clearStoredUsername(storage: Pick<Storage, "removeItem">) {
  storage.removeItem(USERNAME_STORAGE_KEY);
}

export type AuthMode = "login" | "register";

export function createAuthRequest(mode: AuthMode, email: string, password: string, username = "") {
  return {
    endpoint: mode,
    event: `auth:${mode}`,
    payload: mode === "register" ? { email, username, password } : { email, password }
  } as const;
}

export function createSocketAuth(locale: Locale, client: "web" | "desktop") {
  return {
    protocolVersion: PROTOCOL_VERSION,
    locale,
    ...(client === "desktop" ? { client } : {})
  } as const;
}

export {
  appendChatMessage,
  appendDmMessage,
  applyDmReaction,
  deleteDmMessage,
  incrementDmUnread,
  markDmRead,
  updateDmMessage,
  updateFriendPresence,
  updateTypingState
} from "./state.js";

export { createScreenVideoConstraints, formatCallTime, isLocalAudioEnabled } from "./media.js";
export type { ScreenFps, ScreenQuality } from "./media.js";

export {
  getLobbyMemberTransition,
  REALTIME_RETRY_POLICY,
  resolveRealtimeTransports
} from "./realtime.js";
export type { LobbyMemberTransition } from "./realtime.js";
