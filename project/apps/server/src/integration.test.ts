/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { io as createClient, type Socket } from "socket.io-client";
import { createTranslator, safeErrorResponseSchema } from "@echoverse/contracts";
import { closeDatabase, httpServer, initDatabase } from "./index.js";

type AckResponse = { ok: boolean; error?: string; [key: string]: unknown };

let baseUrl = "";
const clients: Socket[] = [];
let fixtureSequence = 0;
const tr = createTranslator("tr");

function emitWithAck(socket: Socket, event: string, payload: unknown): Promise<AckResponse> {
  return new Promise((resolve) => {
    socket.emit(event, payload, (response: AckResponse) => resolve(response));
  });
}

function waitForEvent<T>(socket: Socket, event: string, timeoutMs = 150): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      socket.off(event, onEvent);
      resolve(null);
    }, timeoutMs);
    const onEvent = (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    };
    socket.once(event, onEvent);
  });
}

function connectClient(protocolVersion = 2, client = "desktop", locale?: string) {
  const socket = createClient(baseUrl, {
    auth: { protocolVersion, client, ...(locale ? { locale } : {}) },
    transports: ["websocket"],
    reconnection: false
  });
  clients.push(socket);
  return new Promise<Socket>((resolve, reject) => {
    socket.once("connect", () => resolve(socket));
    socket.once("connect_error", reject);
  });
}

function cookieHeader(response: Response) {
  const raw = response.headers.get("set-cookie") || "";
  return [...raw.matchAll(/(echoverse_(?:access|refresh))=([^;]*)/g)]
    .map((match) => `${match[1]}=${match[2]}`)
    .join("; ");
}

async function registerClient(socket: Socket, prefix: string) {
  const suffix = `${Date.now()}-${fixtureSequence++}`;
  const result = await emitWithAck(socket, "auth:register", {
    email: `${prefix}-${suffix}@example.test`,
    username: `${prefix}${suffix}`,
    password: "secret123"
  });
  expect(result.ok).toBe(true);
  const account = result.account as { id: string };
  return { accountId: account.id, socket };
}

async function establishFriendship(
  requester: { accountId: string; socket: Socket },
  addressee: { accountId: string; socket: Socket }
) {
  expect(
    await emitWithAck(requester.socket, "friends:request", { targetId: addressee.accountId })
  ).toEqual({ ok: true });

  const state = await emitWithAck(addressee.socket, "friends:list", null);
  expect(state.ok).toBe(true);
  const friendshipId = (state.incoming as Array<{ friendshipId?: string }>)[0]?.friendshipId;
  expect(friendshipId).toBeTruthy();
  expect(
    await emitWithAck(addressee.socket, "friends:respond", { friendshipId, accept: true })
  ).toEqual({ ok: true });
}

describe("server HTTP and Socket.IO boundaries", () => {
  beforeAll(async () => {
    await initDatabase();
    await new Promise<void>((resolve) => {
      httpServer.listen(0, "127.0.0.1", () => resolve());
    });
    const address = httpServer.address();
    if (!address || typeof address === "string") throw new Error("server did not bind");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(() => {
    for (const client of clients.splice(0)) client.close();
  });

  afterAll(async () => {
    if (httpServer.listening) {
      await new Promise<void>((resolve, reject) => {
        httpServer.close((error) => (error ? reject(error) : resolve()));
      });
    }
    await closeDatabase();
  });

  it("returns versioned health data with security headers", async () => {
    const response = await fetch(`${baseUrl}/health`);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, protocolVersion: 2 });
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("SAMEORIGIN");
  });

  it("keeps web credentials in HTTP-only cookies and rotates refresh credentials", async () => {
    const suffix = `${Date.now()}-${fixtureSequence++}`;
    const registration = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:5173",
        "X-EchoVerse-Client": "web"
      },
      body: JSON.stringify({
        email: `cookie-${suffix}@example.test`,
        username: `cookie${suffix}`,
        password: "secret123"
      })
    });
    const body = (await registration.json()) as Record<string, unknown>;
    const cookies = cookieHeader(registration);

    expect(registration.status).toBe(200);
    expect(body).toHaveProperty("account");
    expect(body).not.toHaveProperty("accessToken");
    expect(body).not.toHaveProperty("refreshToken");
    expect(cookies).toMatch(/echoverse_access=[^;]+/);
    expect(cookies).toMatch(/echoverse_refresh=[^;]+/);
    expect(registration.headers.get("set-cookie")).toContain("HttpOnly");
    expect(registration.headers.get("set-cookie")).toContain("SameSite=Lax");

    const session = await fetch(`${baseUrl}/auth/session`, {
      headers: { Cookie: cookies, Origin: "http://localhost:5173" }
    });
    expect(session.status).toBe(200);

    const refreshed = await fetch(`${baseUrl}/auth/refresh`, {
      method: "POST",
      headers: { Cookie: cookies, Origin: "http://localhost:5173" }
    });
    const rotatedCookies = cookieHeader(refreshed);
    expect(refreshed.status).toBe(200);
    expect(rotatedCookies).not.toBe(cookies);

    const replay = await fetch(`${baseUrl}/auth/refresh`, {
      method: "POST",
      headers: { Cookie: cookies, Origin: "http://localhost:5173" }
    });
    expect(replay.status).toBe(401);

    const logout = await fetch(`${baseUrl}/auth/logout`, {
      method: "POST",
      headers: { Cookie: rotatedCookies, Origin: "http://localhost:5173" }
    });
    expect(logout.status).toBe(200);
    const afterLogout = await fetch(`${baseUrl}/auth/session`, {
      headers: { Cookie: rotatedCookies, Origin: "http://localhost:5173" }
    });
    expect(afterLogout.status).toBe(401);
  });

  it("does not expose socket login as a browser credential transport", async () => {
    const client = await connectClient(2, "web");
    const response = await emitWithAck(client, "auth:login", {
      email: "nobody@example.test",
      password: "secret123"
    });
    expect(response).toEqual({
      ok: false,
      error: tr("server.webAuthHttpOnly")
    });
  });

  it("resolves server errors from the requested locale", async () => {
    const httpResponse = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-EchoVerse-Locale": "en"
      },
      body: JSON.stringify({ email: "missing@example.test", password: "secret123" })
    });
    const httpBody = (await httpResponse.json()) as AckResponse;
    expect(httpBody).toEqual({ ok: false, error: "The email or password is incorrect." });

    const client = await connectClient(2, "web", "en");
    const socketBody = await emitWithAck(client, "friends:list", null);
    expect(socketBody).toEqual({ ok: false, error: "A session is required." });

    const unsupportedLocaleResponse = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-EchoVerse-Locale": "trick"
      },
      body: JSON.stringify({ email: "missing@example.test", password: "secret123" })
    });
    const unsupportedLocaleBody = (await unsupportedLocaleResponse.json()) as AckResponse;
    expect(unsupportedLocaleBody).toEqual(httpBody);

    const unsupportedLocaleClient = await connectClient(2, "web", "trick");
    const unsupportedLocaleSocketBody = await emitWithAck(
      unsupportedLocaleClient,
      "friends:list",
      null
    );
    expect(unsupportedLocaleSocketBody).toEqual(socketBody);
  });

  it("redacts rejected origins and malformed JSON", async () => {
    const rejectedOrigin = await fetch(`${baseUrl}/health`, {
      headers: { Origin: "https://untrusted.example" }
    });
    const rejectedBody = (await rejectedOrigin.json()) as unknown;
    expect(rejectedOrigin.status).toBe(400);
    expect(safeErrorResponseSchema.safeParse(rejectedBody).success).toBe(true);
    expect(JSON.stringify(rejectedBody)).not.toContain("stack");

    const malformed = await fetch(`${baseUrl}/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{"
    });
    const malformedBody = (await malformed.json()) as unknown;
    expect(malformed.status).toBe(400);
    expect(safeErrorResponseSchema.safeParse(malformedBody).success).toBe(true);
  });

  it("rejects oversized HTTP JSON bodies with a safe error", async () => {
    const response = await fetch(`${baseUrl}/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload: "x".repeat(1_100_000) })
    });
    const body = (await response.json()) as unknown;

    expect(response.status).toBe(400);
    expect(safeErrorResponseSchema.safeParse(body).success).toBe(true);
    expect(JSON.stringify(body)).not.toMatch(/stack|payload|x{20}/i);
  });

  it("rejects unsupported Socket.IO protocol versions", async () => {
    await expect(connectClient(1, "desktop", "en")).rejects.toThrow(/Unsupported protocol version/);
  });

  it("supports registration and denies unauthorised friend access", async () => {
    const client = await connectClient();
    const timestamp = Date.now();
    const registered = await emitWithAck(client, "auth:register", {
      email: `integration-${timestamp}@example.test`,
      username: `test${timestamp}`,
      password: "secret123"
    });
    expect(registered.ok).toBe(true);
    expect(registered).toHaveProperty("token");

    const friends = await emitWithAck(client, "friends:list", null);
    expect(friends).toEqual({ ok: true, accepted: [], incoming: [], outgoing: [] });
  });

  it("returns safe authorization errors for an unauthenticated socket", async () => {
    const client = await connectClient(2, "web");
    const response = await emitWithAck(client, "friends:list", null);
    expect(safeErrorResponseSchema.safeParse(response).success).toBe(true);
    expect(response.error).toBe(tr("server.sessionRequired"));
  });

  it("rejects malformed Socket.IO payloads before handlers run", async () => {
    const client = await connectClient(2, "web");
    const response = await emitWithAck(client, "friends:search", {
      query: "valid",
      unexpected: "field"
    });

    expect(response).toEqual({ ok: false, error: tr("server.invalidRequest") });
    expect(safeErrorResponseSchema.safeParse(response).success).toBe(true);
  });

  it("preserves combining marks, emoji, and CJK text through username search", async () => {
    const searcher = await registerClient(await connectClient(2, "desktop", "tr"), "search");
    const targetSocket = await connectClient();
    const suffix = `${Date.now()}-${fixtureSequence++}`;
    const targetResponse = await emitWithAck(targetSocket, "auth:register", {
      email: `unicode-target-${suffix}@example.test`,
      username: "İpek🙂漢字ı̆",
      password: "secret123"
    });

    expect(targetResponse.ok).toBe(true);

    const response = await emitWithAck(searcher.socket, "friends:search", {
      query: "🙂漢字ı̆"
    });

    expect(response).toMatchObject({ ok: true });
    expect(response.results).toEqual(
      expect.arrayContaining([expect.objectContaining({ username: "İpek🙂漢字ı̆" })])
    );

    const localeAwareResponse = await emitWithAck(searcher.socket, "friends:search", {
      query: "İPEK"
    });
    expect(localeAwareResponse.results).toEqual(
      expect.arrayContaining([expect.objectContaining({ username: "İpek🙂漢字ı̆" })])
    );

    const wildcardResponse = await emitWithAck(searcher.socket, "friends:search", {
      query: "%"
    });
    expect(wildcardResponse.results).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ username: "İpek🙂漢字ı̆" })])
    );
  });

  it("blocks cross-user direct-message access before persistence", async () => {
    const sender = await connectClient();
    const recipient = await connectClient();
    const timestamp = Date.now();
    const senderResult = await emitWithAck(sender, "auth:register", {
      email: `sender-${timestamp}@example.test`,
      username: `sender${timestamp}`,
      password: "secret123"
    });
    const recipientResult = await emitWithAck(recipient, "auth:register", {
      email: `recipient-${timestamp}@example.test`,
      username: `recipient${timestamp}`,
      password: "secret123"
    });
    const recipientAccount = recipientResult.account as { id: string };
    expect(senderResult.ok).toBe(true);
    expect(recipientResult.ok).toBe(true);

    const response = await emitWithAck(sender, "dm:send", {
      friendId: recipientAccount.id,
      body: "private message"
    });
    expect(response).toEqual({ ok: false, error: tr("server.notFriends") });

    const history = await emitWithAck(sender, "dm:history", { friendId: recipientAccount.id });
    expect(history).toEqual({ ok: false, error: tr("server.notFriends") });
  });

  it("rejects oversized direct-message attachments at the socket boundary", async () => {
    const sender = await registerClient(await connectClient(), "att-sender");
    const recipient = await registerClient(await connectClient(), "att-target");
    await establishFriendship(sender, recipient);

    const response = await emitWithAck(sender.socket, "dm:send", {
      friendId: recipient.accountId,
      body: "",
      attachment: {
        name: "payload.txt",
        mime: "text/plain",
        data: `data:text/plain;base64,${"A".repeat(5_700_001)}`
      }
    });

    expect(response).toEqual({ ok: false, error: tr("server.invalidRequest") });

    const invalidMime = await emitWithAck(sender.socket, "dm:send", {
      friendId: recipient.accountId,
      body: "",
      attachment: {
        name: "payload.txt",
        mime: "image/png",
        data: "data:text/plain;base64,SGVsbG8="
      }
    });
    expect(invalidMime).toEqual({ ok: false, error: tr("server.invalidRequest") });
  });

  it("expires unanswered calls and notifies both participants", async () => {
    const caller = await registerClient(await connectClient(), "call-caller");
    const target = await registerClient(await connectClient(), "call-target");
    await establishFriendship(caller, target);

    const callerAnswer = new Promise<AckResponse>((resolve) => {
      caller.socket.once("call:answered", resolve);
    });
    const targetMissed = new Promise<AckResponse>((resolve) => {
      target.socket.once("call:missed", resolve);
    });

    vi.useFakeTimers();
    try {
      const started = await emitWithAck(caller.socket, "call:start", {
        friendId: target.accountId
      });
      expect(started.ok).toBe(true);

      await vi.advanceTimersByTimeAsync(35_000);

      await expect(callerAnswer).resolves.toMatchObject({ accept: false, reason: "timeout" });
      await expect(targetMissed).resolves.toMatchObject({ fromAccountId: caller.accountId });
    } finally {
      vi.useRealTimers();
    }
  });

  it("limits guild membership, presence, call control, and signaling to authorized peers", async () => {
    const owner = await registerClient(await connectClient(), "gowner");
    const member = await registerClient(await connectClient(), "gmember");
    const outsider = await registerClient(await connectClient(), "goutside");

    const created = await emitWithAck(owner.socket, "guild:create", { name: "Private Guild" });
    expect(created.ok).toBe(true);
    const guild = created.guild as { id: string };

    expect(await emitWithAck(member.socket, "join-room", { guildId: guild.id })).toEqual({
      ok: false,
      error: tr("server.guildMembershipRequired")
    });
    expect(await emitWithAck(member.socket, "guild:join-code", { code: guild.id })).toEqual({
      ok: true,
      guild: expect.objectContaining({ id: guild.id })
    });
    expect(await emitWithAck(member.socket, "join-room", { guildId: guild.id })).toEqual({
      ok: true,
      guildId: guild.id
    });

    await emitWithAck(outsider.socket, "presence:set", { status: "dnd" });
    const hiddenPresence = await emitWithAck(owner.socket, "presence:get", {
      accountIds: [outsider.accountId]
    });
    expect(hiddenPresence).toEqual({ ok: true, presence: { [outsider.accountId]: "offline" } });

    await establishFriendship(owner, member);
    const started = await emitWithAck(owner.socket, "call:start", { friendId: member.accountId });
    expect(started.ok).toBe(true);
    const callId = String(started.callId);

    const answered = waitForEvent<AckResponse>(owner.socket, "call:answered");
    outsider.socket.emit("call:answer", {
      callId,
      toSocketId: owner.socket.id,
      accept: true
    });
    member.socket.emit("call:answer", {
      callId,
      toSocketId: owner.socket.id,
      accept: true
    });
    await expect(answered).resolves.toMatchObject({ accept: true });

    const unauthorizedSignal = waitForEvent(member.socket, "webrtc-offer");
    outsider.socket.emit("webrtc-offer", {
      to: member.socket.id,
      sdp: { type: "offer", sdp: "v=0 unauthorized" }
    });
    await expect(unauthorizedSignal).resolves.toBeNull();

    const authorizedSignal = waitForEvent<{ from: string; sdp: { type: string } }>(
      member.socket,
      "webrtc-offer"
    );
    owner.socket.emit("webrtc-offer", {
      to: member.socket.id,
      sdp: { type: "offer", sdp: "v=0 authorized" }
    });
    await expect(authorizedSignal).resolves.toMatchObject({
      from: owner.socket.id,
      sdp: { type: "offer" }
    });

    const unauthorizedEnd = waitForEvent(owner.socket, "call:ended");
    outsider.socket.emit("call:end", { callId, toSocketId: owner.socket.id });
    await expect(unauthorizedEnd).resolves.toBeNull();

    const ended = waitForEvent<AckResponse>(owner.socket, "call:ended");
    member.socket.emit("call:end", { callId, toSocketId: owner.socket.id });
    await expect(ended).resolves.toMatchObject({ callId });
  });

  it("rejects malformed and stale WebRTC signals and cleans calls on disconnect", async () => {
    const caller = await registerClient(await connectClient(), "ccaller");
    const target = await registerClient(await connectClient(), "ctarget");
    await establishFriendship(caller, target);

    const incoming = waitForEvent<{ callId: string }>(target.socket, "call:incoming");
    const started = await emitWithAck(caller.socket, "call:start", {
      friendId: target.accountId
    });
    expect(started.ok).toBe(true);
    const call = await incoming;
    expect(call?.callId).toBe(started.callId);

    const answered = waitForEvent(caller.socket, "call:answered");
    target.socket.emit("call:answer", {
      callId: started.callId,
      toSocketId: caller.socket.id,
      accept: true
    });
    await expect(answered).resolves.toMatchObject({ accept: true });

    const malformed = waitForEvent(target.socket, "webrtc-offer");
    caller.socket.emit("webrtc-offer", {
      to: target.socket.id,
      sdp: { type: "offer", sdp: "" }
    });
    await expect(malformed).resolves.toBeNull();

    const ended = waitForEvent(target.socket, "call:ended");
    caller.socket.disconnect();
    await expect(ended).resolves.toMatchObject({ callId: started.callId });

    const stale = waitForEvent(target.socket, "webrtc-offer");
    target.socket.emit("webrtc-offer", {
      to: target.socket.id,
      sdp: { type: "offer", sdp: "v=0 stale" }
    });
    await expect(stale).resolves.toBeNull();
  });

  it("enforces the per-socket authentication rate limit", async () => {
    const client = await connectClient();
    const responses: AckResponse[] = [];
    for (let index = 0; index < 9; index += 1) {
      responses.push(
        await emitWithAck(client, "auth:register", {
          email: `rate-${Date.now()}-${index}@example.test`,
          username: `rate${Date.now()}${index}`,
          password: "secret123"
        })
      );
    }

    expect(responses.slice(0, 8).every((response) => response.ok === true)).toBe(true);
    expect(responses[8]).toMatchObject({ ok: false });
    expect(responses[8].error).toBe(tr("server.rateLimited"));
  });
});
