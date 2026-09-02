/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { describe, expect, it } from "vitest";
import {
  SESSION_TOKEN_KEY,
  appendChatMessage,
  appendDmMessage,
  applyDmReaction,
  clearSessionToken,
  clearStoredUsername,
  createScreenVideoConstraints,
  formatCallTime,
  createAuthRequest,
  getLobbyMemberTransition,
  createSocketAuth,
  deleteDmMessage,
  incrementDmUnread,
  markDmRead,
  persistSession,
  readClientLocale,
  readSessionToken,
  readStoredUsername,
  readStoredSession,
  isLocalAudioEnabled,
  REALTIME_RETRY_POLICY,
  resolveRealtimeTransports,
  shouldInitiateVoicePeer,
  updateDmMessage,
  updateFriendPresence,
  updateTypingState,
  writeClientLocale,
  writeStoredUsername,
  writeSessionToken
} from "./index.js";

describe("realtime recovery policy", () => {
  it("bounds reconnect attempts and delays", () => {
    expect(REALTIME_RETRY_POLICY).toEqual({
      reconnection: true,
      reconnectionAttempts: 8,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5_000,
      timeout: 10_000
    });
  });

  it("keeps the hosted endpoint on polling while preserving local upgrades", () => {
    expect(resolveRealtimeTransports("https://echoverse.borayarkin.net")).toEqual(["polling"]);
    expect(resolveRealtimeTransports("http://127.0.0.1:3001")).toEqual(["polling", "websocket"]);
    expect(resolveRealtimeTransports("not a URL")).toEqual(["polling", "websocket"]);
  });

  it("selects one deterministic guild voice offerer per socket pair", () => {
    expect(shouldInitiateVoicePeer("socket-a", "socket-b")).toBe(true);
    expect(shouldInitiateVoicePeer("socket-b", "socket-a")).toBe(false);
    expect(shouldInitiateVoicePeer("socket-a", "socket-a")).toBe(false);
    expect(shouldInitiateVoicePeer(undefined, "socket-b")).toBe(false);
  });
});

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

  it("shares locale, username, and auth request boundaries", () => {
    const storage = storageFixture();
    expect(readClientLocale(storage, "tr-TR")).toBe("tr");
    writeClientLocale(storage, "en");
    writeStoredUsername(storage, "Ada");
    expect(readClientLocale(storage, "tr-TR")).toBe("en");
    expect(readStoredUsername(storage)).toBe("Ada");
    expect(createAuthRequest("register", "user@example.com", "secret123", "Ada")).toEqual({
      endpoint: "register",
      event: "auth:register",
      payload: { email: "user@example.com", username: "Ada", password: "secret123" }
    });
    expect(createSocketAuth("en", "web")).toEqual({ protocolVersion: 2, locale: "en" });
    expect(createSocketAuth("tr", "desktop")).toEqual({
      protocolVersion: 2,
      locale: "tr",
      client: "desktop"
    });
    clearStoredUsername(storage);
    expect(readStoredUsername(storage)).toBe("");
  });

  it("applies deterministic shared DM and presence state transitions", () => {
    const chatMessage = {
      id: "chat-1",
      username: "Ada",
      text: "hello",
      createdAt: "2026-08-27T00:00:00.000Z"
    };
    expect(appendChatMessage([chatMessage], chatMessage)).toEqual([chatMessage]);

    const message = {
      id: "message-1",
      senderId: "account-1",
      recipientId: "account-2",
      body: "hello",
      createdAt: "2026-08-27T00:00:00.000Z",
      attachmentName: "image.png",
      attachmentMime: "image/png",
      attachmentData: "data"
    };
    const duplicate = appendDmMessage([message], message);
    expect(duplicate).toHaveLength(1);

    const edited = updateDmMessage(duplicate, { ...message, body: "edited" });
    expect(edited[0]?.body).toBe("edited");
    expect(applyDmReaction(edited, message.id, { "👍": ["account-2"] })[0]?.reactions).toEqual({
      "👍": ["account-2"]
    });

    const deleted = deleteDmMessage(edited, message.id, "2026-08-27T00:01:00.000Z");
    expect(deleted[0]).toMatchObject({
      body: "",
      deletedAt: "2026-08-27T00:01:00.000Z",
      attachmentName: null,
      attachmentMime: null,
      attachmentData: null
    });

    const friends = [{ id: "account-2", username: "Ada", status: "offline" as const }];
    expect(updateFriendPresence(friends, "account-2", "online")[0]?.status).toBe("online");
    expect(updateTypingState({}, "account-2", true)).toEqual({ "account-2": true });
    expect(markDmRead({ "account-2": 3, "account-3": 1 }, "account-2")).toEqual({
      "account-2": 0,
      "account-3": 1
    });
    expect(incrementDmUnread({ "account-2": 3 }, "account-2")).toEqual({ "account-2": 4 });
  });

  it("keeps shared media controls fail-closed and bounded", () => {
    expect(formatCallTime(0)).toBe("00:00");
    expect(formatCallTime(125)).toBe("02:05");
    expect(isLocalAudioEnabled(false, false, false, false)).toBe(true);
    expect(isLocalAudioEnabled(true, false, false, true)).toBe(false);
    expect(isLocalAudioEnabled(false, true, false, true)).toBe(false);
    expect(isLocalAudioEnabled(false, false, true, false)).toBe(false);
    expect(isLocalAudioEnabled(false, false, true, true)).toBe(true);
    expect(createScreenVideoConstraints("720", 30)).toEqual({
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30, max: 30 }
    });
    expect(createScreenVideoConstraints("1080", 60)).toEqual({
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      frameRate: { ideal: 60, max: 60 }
    });
  });

  it("reconciles lobby membership and suppresses reconnect announcements", () => {
    const previous = [
      { socketId: "self", userId: "account-1", username: "Ada" },
      { socketId: "peer-1", userId: "account-2", username: "Lin" }
    ];
    const next = [
      { socketId: "self", userId: "account-1", username: "Ada" },
      { socketId: "peer-2", userId: "account-3", username: "Mert" }
    ];

    expect(getLobbyMemberTransition(previous, next, "self", false)).toEqual({
      memberSocketIds: ["self", "peer-2"],
      joinedSomeone: true,
      leftSomeone: true
    });
    expect(getLobbyMemberTransition(previous, next, "self", true)).toEqual({
      memberSocketIds: ["self", "peer-2"],
      joinedSomeone: false,
      leftSomeone: false
    });
  });
});
