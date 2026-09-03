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

async function registerExactClient(socket: Socket, email: string, username: string) {
  const result = await emitWithAck(socket, "auth:register", {
    email,
    username,
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

  it("authenticates a browser Socket.IO session from the HTTP-only cookie", async () => {
    const suffix = `${Date.now()}-${fixtureSequence++}`;
    const registration = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:5173",
        "X-EchoVerse-Client": "web"
      },
      body: JSON.stringify({
        email: `socket-web-${suffix}@example.test`,
        username: `socketweb${suffix}`,
        password: "secret123"
      })
    });
    expect(registration.status).toBe(200);
    const cookies = cookieHeader(registration);
    const socket = createClient(baseUrl, {
      auth: { protocolVersion: 2, locale: "tr" },
      extraHeaders: { Cookie: cookies },
      transports: ["websocket"],
      reconnection: false
    });
    clients.push(socket);

    const guildListPromise = new Promise<any[]>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("browser guild list timeout")), 500);
      socket.once("guild:list", (list: any[]) => {
        clearTimeout(timer);
        resolve(list);
      });
    });

    await new Promise<void>((resolve, reject) => {
      socket.once("connect", () => resolve());
      socket.once("connect_error", reject);
    });

    const guilds = await guildListPromise;
    expect(guilds).toEqual(expect.arrayContaining([expect.objectContaining({ id: "echoverse" })]));

    expect(await emitWithAck(socket, "guild:select", { guildId: "echoverse" })).toEqual({
      ok: true,
      guildId: "echoverse"
    });
    const lobbyStatePromise = new Promise<{ members: any[] }>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("browser voice lobby timeout")), 500);
      socket.once("voice:lobby-state", (state: { members: any[] }) => {
        clearTimeout(timer);
        resolve(state);
      });
    });
    expect(await emitWithAck(socket, "join-room", { guildId: "echoverse" })).toEqual({
      ok: true,
      guildId: "echoverse"
    });
    expect((await lobbyStatePromise).members).toEqual(
      expect.arrayContaining([expect.objectContaining({ socketId: socket.id })])
    );
    const chat = await emitWithAck(socket, "chat-message", {
      guildId: "echoverse",
      channelId: "echoverse:general",
      text: "browser transport works"
    });
    expect(chat).toEqual({
      ok: true,
      message: expect.objectContaining({ text: "browser transport works" })
    });
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

  it("supports offline requests, duplicate protection, cancellation, and later acceptance", async () => {
    const requester = await registerClient(await connectClient(), "frq");
    const targetEmail = `friend-target-${Date.now()}-${fixtureSequence++}@example.test`;
    const targetPassword = "secret123";
    const target = await connectClient();
    const targetRegistration = await emitWithAck(target, "auth:register", {
      email: targetEmail,
      username: `friendtarget${fixtureSequence}`,
      password: targetPassword
    });
    expect(targetRegistration.ok).toBe(true);
    const targetAccount = targetRegistration.account as { id: string };

    target.close();
    expect(
      await emitWithAck(requester.socket, "friends:request", { targetId: targetAccount.id })
    ).toEqual({ ok: true });
    expect(
      await emitWithAck(requester.socket, "friends:request", { targetId: targetAccount.id })
    ).toEqual({ ok: false, error: tr("server.friendshipExists") });

    const pendingSearch = await emitWithAck(requester.socket, "friends:search", {
      query: "friendtarget"
    });
    expect(pendingSearch.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: targetAccount.id, relationship: "pending_outgoing" })
      ])
    );

    const reconnectedTarget = await connectClient();
    expect(
      await emitWithAck(reconnectedTarget, "auth:login", {
        email: targetEmail,
        password: targetPassword
      })
    ).toMatchObject({ ok: true });
    const incoming = await emitWithAck(reconnectedTarget, "friends:list", null);
    const pendingId = (incoming.incoming as Array<{ friendshipId: string }>)[0]?.friendshipId;
    expect(pendingId).toEqual(expect.any(String));

    expect(
      await emitWithAck(requester.socket, "friends:cancel", { friendshipId: pendingId })
    ).toEqual({ ok: true });
    expect(await emitWithAck(requester.socket, "friends:list", null)).toMatchObject({
      outgoing: []
    });
    expect(await emitWithAck(reconnectedTarget, "friends:list", null)).toMatchObject({
      incoming: []
    });

    expect(
      await emitWithAck(requester.socket, "friends:request", { targetId: targetAccount.id })
    ).toEqual({ ok: true });
    const secondIncoming = await emitWithAck(reconnectedTarget, "friends:list", null);
    const secondPendingId = (secondIncoming.incoming as Array<{ friendshipId: string }>)[0]
      ?.friendshipId;
    expect(
      await emitWithAck(reconnectedTarget, "friends:respond", {
        friendshipId: secondPendingId,
        accept: true
      })
    ).toEqual({ ok: true });
    expect(await emitWithAck(requester.socket, "friends:list", null)).toMatchObject({
      accepted: [expect.objectContaining({ id: targetAccount.id })]
    });
  });

  it("quarantines non-friend direct messages until the recipient accepts", async () => {
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

    const requestReceived = waitForEvent<any>(recipient, "dm:request-received");
    const response = await emitWithAck(sender, "dm:send", {
      friendId: recipientAccount.id,
      body: "private message"
    });
    expect(response).toMatchObject({ ok: true, request: { body: "private message" } });
    await expect(requestReceived).resolves.toMatchObject({
      senderUsername: expect.any(String),
      body: "private message",
      status: "pending"
    });

    expect(
      await emitWithAck(sender, "dm:send", {
        friendId: recipientAccount.id,
        body: "second attempt"
      })
    ).toEqual({ ok: false, error: tr("server.messageRequestPending") });

    const requests = await emitWithAck(recipient, "dm:requests", {});
    expect(requests.incoming).toEqual(
      expect.arrayContaining([expect.objectContaining({ body: "private message" })])
    );
    const requestId = (requests.incoming as Array<{ id: string }>)[0]?.id;
    expect(
      await emitWithAck(sender, "dm:request-respond", { requestId, action: "accept" })
    ).toEqual({ ok: false, error: tr("server.messageRequestNotFound") });
    const delivered = waitForEvent<any>(sender, "dm:message");
    const accepted = await emitWithAck(recipient, "dm:request-respond", {
      requestId,
      action: "accept"
    });
    expect(accepted).toMatchObject({ ok: true, message: { body: "private message" } });
    await expect(delivered).resolves.toMatchObject({ body: "private message" });

    const history = await emitWithAck(sender, "dm:history", { friendId: recipientAccount.id });
    expect(history).toMatchObject({
      ok: true,
      messages: [expect.objectContaining({ body: "private message" })]
    });
  });

  it("enforces DM privacy and persists per-peer mute and archive preferences", async () => {
    const sender = await registerClient(await connectClient(), "dms");
    const recipient = await registerClient(await connectClient(), "dmt");

    const defaults = await emitWithAck(recipient.socket, "dm:preferences", {});
    expect(defaults).toMatchObject({
      ok: true,
      privacy: { allowNonFriendRequests: true },
      peers: []
    });

    const disabled = await emitWithAck(recipient.socket, "dm:privacy-update", {
      allowNonFriendRequests: false
    });
    expect(disabled).toMatchObject({ ok: true, privacy: { allowNonFriendRequests: false } });
    expect(
      await emitWithAck(sender.socket, "dm:send", {
        friendId: recipient.accountId,
        body: "should be rejected"
      })
    ).toEqual({ ok: false, error: tr("server.messageRequestsDisabled") });

    const enabled = await emitWithAck(recipient.socket, "dm:privacy-update", {
      allowNonFriendRequests: true
    });
    expect(enabled).toMatchObject({ ok: true, privacy: { allowNonFriendRequests: true } });

    const preference = await emitWithAck(recipient.socket, "dm:peer-preference-update", {
      peerId: sender.accountId,
      muted: true,
      archived: true
    });
    expect(preference).toEqual({
      ok: true,
      preference: { peerId: sender.accountId, muted: true, archived: true }
    });

    const stored = await emitWithAck(recipient.socket, "dm:preferences", {});
    expect(stored).toMatchObject({
      ok: true,
      privacy: { allowNonFriendRequests: true },
      peers: [{ peerId: sender.accountId, muted: true, archived: true }]
    });

    expect(
      await emitWithAck(recipient.socket, "dm:peer-preference-update", {
        peerId: recipient.accountId,
        muted: true
      })
    ).toEqual({ ok: false, error: tr("server.userNotFound") });
  });

  it("accepts authenticated direct-message reports without exposing message content", async () => {
    const reporter = await registerClient(await connectClient(), "reporter");
    const target = await registerClient(await connectClient(), "report-target");

    const report = await emitWithAck(reporter.socket, "dm:report", {
      targetId: target.accountId,
      reason: "unwanted contact"
    });
    expect(report).toMatchObject({
      ok: true,
      created: true,
      report: {
        reporterId: reporter.accountId,
        targetId: target.accountId,
        messageId: null,
        reason: "unwanted contact",
        status: "open"
      }
    });
    expect(report.report).not.toHaveProperty("body");

    const replay = await emitWithAck(reporter.socket, "dm:report", {
      targetId: target.accountId,
      reason: "changed reason"
    });
    expect(replay).toEqual({ ok: true, created: false, report: report.report });

    expect(
      await emitWithAck(reporter.socket, "dm:report", {
        targetId: reporter.accountId,
        reason: "self report"
      })
    ).toEqual({ ok: false, error: tr("server.dmReportTargetInvalid") });

    expect(
      await emitWithAck(reporter.socket, "dm:report", {
        targetId: target.accountId,
        messageId: "not-a-real-message",
        reason: "bad reference"
      })
    ).toEqual({ ok: false, error: tr("server.dmReportMessageAccessDenied") });
  });

  it("does not deliver quarantined messages after a recipient marks the request as spam", async () => {
    const sender = await registerClient(await connectClient(), "spam-sender");
    const recipient = await registerClient(await connectClient(), "spam-target");
    expect(
      await emitWithAck(sender.socket, "dm:send", {
        friendId: recipient.accountId,
        body: "unwanted"
      })
    ).toMatchObject({ ok: true });
    const requests = await emitWithAck(recipient.socket, "dm:requests", {});
    const requestId = (requests.incoming as Array<{ id: string }>)[0]?.id;
    expect(
      await emitWithAck(recipient.socket, "dm:request-respond", {
        requestId,
        action: "spam"
      })
    ).toEqual({ ok: true, request: expect.objectContaining({ status: "spam" }) });
    expect(
      await emitWithAck(sender.socket, "dm:send", {
        friendId: recipient.accountId,
        body: "again"
      })
    ).toEqual({ ok: false, error: tr("server.messageRequestClosed") });
  });

  it("cannot accept a request after the recipient blocks the sender", async () => {
    const sender = await registerClient(await connectClient(), "brsender");
    const recipient = await registerClient(await connectClient(), "brtarget");
    expect(
      await emitWithAck(sender.socket, "dm:send", {
        friendId: recipient.accountId,
        body: "please ignore"
      })
    ).toMatchObject({ ok: true });
    const requests = await emitWithAck(recipient.socket, "dm:requests", {});
    const requestId = (requests.incoming as Array<{ id: string }>)[0]?.id;
    expect(
      await emitWithAck(recipient.socket, "friends:block", { targetId: sender.accountId })
    ).toEqual({ ok: true });
    expect(
      await emitWithAck(recipient.socket, "dm:request-respond", {
        requestId,
        action: "accept"
      })
    ).toEqual({ ok: false, error: tr("server.messageRequestNotFound") });
    expect(
      await emitWithAck(sender.socket, "dm:send", {
        friendId: recipient.accountId,
        body: "retry"
      })
    ).toEqual({ ok: false, error: tr("server.userBlocked") });
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

  it("persists group conversations, enforces membership, and fans out messages", async () => {
    const owner = await registerClient(await connectClient(), "group-owner");
    const first = await registerClient(await connectClient(), "group-first");
    const second = await registerClient(await connectClient(), "group-second");
    await establishFriendship(owner, first);
    await establishFriendship(owner, second);

    const created = await emitWithAck(owner.socket, "dm:group-create", {
      memberIds: [first.accountId, second.accountId],
      name: "Project room"
    });
    expect(created.ok).toBe(true);
    const conversation = created.conversation as { id: string; members: unknown[] };
    expect(conversation.members).toHaveLength(3);

    const firstHistory = await emitWithAck(first.socket, "dm:history", {
      conversationId: conversation.id
    });
    expect(firstHistory).toMatchObject({ ok: true, messages: [] });

    const delivered = waitForEvent<any>(second.socket, "dm:message");
    const sent = await emitWithAck(owner.socket, "dm:send", {
      conversationId: conversation.id,
      body: "hello group"
    });
    expect(sent).toMatchObject({ ok: true, message: { conversationId: conversation.id } });
    await expect(delivered).resolves.toMatchObject({ body: "hello group" });
    expect(
      await emitWithAck(first.socket, "dm:report", {
        targetId: owner.accountId,
        messageId: (sent.message as { id: string }).id,
        reason: "group message"
      })
    ).toEqual({ ok: false, error: tr("server.dmReportMessageAccessDenied") });
  });

  it("enforces group roles and starts a bounded group call", async () => {
    const owner = await registerClient(await connectClient(), "role-owner");
    const first = await registerClient(await connectClient(), "role-first");
    const second = await registerClient(await connectClient(), "role-second");
    await establishFriendship(owner, first);
    await establishFriendship(owner, second);

    const created = await emitWithAck(owner.socket, "dm:group-create", {
      memberIds: [first.accountId, second.accountId]
    });
    expect(created.ok).toBe(true);
    const conversationId = (created.conversation as { id: string }).id;

    expect(
      await emitWithAck(owner.socket, "dm:group-promote", {
        conversationId,
        accountId: first.accountId
      })
    ).toMatchObject({ ok: true });
    expect(
      await emitWithAck(first.socket, "dm:group-remove", {
        conversationId,
        accountId: second.accountId
      })
    ).toMatchObject({ ok: true });
    expect(await emitWithAck(owner.socket, "dm:group-leave", { conversationId })).toEqual({
      ok: false,
      error: tr("server.group.owner_cannot_leave")
    });

    const incoming = waitForEvent<any>(first.socket, "call:incoming");
    const started = await emitWithAck(owner.socket, "call:start", { conversationId });
    expect(started).toMatchObject({ ok: true, groupCall: true });
    await expect(incoming).resolves.toMatchObject({
      callId: started.callId,
      conversationId,
      groupCall: true
    });

    const answered = waitForEvent<any>(owner.socket, "call:answered");
    first.socket.emit("call:answer", {
      callId: started.callId,
      toSocketId: owner.socket.id,
      accept: true
    });
    await expect(answered).resolves.toMatchObject({
      callId: started.callId,
      responderAccountId: first.accountId,
      groupCall: true
    });

    const ended = waitForEvent<any>(first.socket, "call:ended");
    owner.socket.emit("call:end", {
      callId: started.callId,
      toSocketId: first.socket.id
    });
    await expect(ended).resolves.toMatchObject({ callId: started.callId, groupCall: true });
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

      const duplicate = await emitWithAck(caller.socket, "call:start", {
        friendId: target.accountId
      });
      expect(duplicate).toEqual({ ok: false, error: tr("call.alreadyActive") });

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

    const created = (await emitWithAck(owner.socket, "guild:create", {
      name: "Private Guild"
    })) as { ok: boolean; guild: { id: string }; invite?: { token: string } };
    expect(created.ok).toBe(true);
    expect(created.invite?.token).toEqual(expect.any(String));
    const guild = created.guild as { id: string };

    expect(await emitWithAck(member.socket, "join-room", { guildId: guild.id })).toEqual({
      ok: false,
      error: tr("server.guildMembershipRequired")
    });
    const invite = (await emitWithAck(owner.socket, "guild:create-invite", {
      guildId: guild.id
    })) as {
      ok: boolean;
      invite: { token: string };
    };
    expect(invite.ok).toBe(true);
    expect(
      await emitWithAck(member.socket, "guild:join-code", { code: invite.invite.token })
    ).toEqual({
      ok: true,
      guild: expect.objectContaining({ id: guild.id })
    });
    expect(await emitWithAck(member.socket, "join-room", { guildId: guild.id })).toEqual({
      ok: true,
      guildId: guild.id
    });

    expect(
      await emitWithAck(member.socket, "guild:rename-lobby", {
        guildId: guild.id,
        name: "Member Attempt"
      })
    ).toEqual({
      ok: false,
      error: tr("server.guildPermissionRequired")
    });
    const renamed = await emitWithAck(owner.socket, "guild:rename-lobby", {
      guildId: guild.id,
      name: "Quiet Room"
    });
    expect(renamed).toMatchObject({
      ok: true,
      guild: { id: guild.id, lobbyName: "Quiet Room" }
    });
    expect(
      await emitWithAck(owner.socket, "guild:set-role", {
        guildId: guild.id,
        accountId: member.accountId,
        role: "admin"
      })
    ).toEqual({ ok: true });
    expect(
      await emitWithAck(member.socket, "guild:rename-lobby", {
        guildId: guild.id,
        name: "Admin Room"
      })
    ).toMatchObject({ ok: true, guild: { lobbyName: "Admin Room" } });

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

  it("deletes a private guild only for the owner and approved test members", async () => {
    const owner = await registerExactClient(await connectClient(), "test@test.com", "DeleteOwner");
    const approved = await registerExactClient(
      await connectClient(),
      "test2@test2.com",
      "DeleteTest"
    );
    const outsider = await registerClient(await connectClient(), "outsider");
    const created = (await emitWithAck(owner.socket, "guild:create", {
      name: "Delete Guild"
    })) as { ok: boolean; guild: { id: string }; invite: { token: string } };
    expect(created.ok).toBe(true);

    expect(
      await emitWithAck(approved.socket, "guild:join-code", { code: created.invite.token })
    ).toMatchObject({
      ok: true,
      guild: { id: created.guild.id }
    });
    expect(
      await emitWithAck(outsider.socket, "guild:join-code", { code: created.invite.token })
    ).toMatchObject({
      ok: true,
      guild: { id: created.guild.id }
    });
    expect(await emitWithAck(owner.socket, "guild:delete", { guildId: created.guild.id })).toEqual({
      ok: false,
      error: tr("server.guildDeleteMembersPresent")
    });

    expect(
      await emitWithAck(outsider.socket, "guild:leave", { guildId: created.guild.id })
    ).toEqual({
      ok: true
    });
    expect(await emitWithAck(owner.socket, "guild:delete", { guildId: created.guild.id })).toEqual({
      ok: true
    });
    expect(await emitWithAck(owner.socket, "guild:select", { guildId: created.guild.id })).toEqual({
      ok: false,
      error: tr("server.guildMembershipRequired")
    });
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

  it("relays WebRTC signaling between members of the same guild voice lobby", async () => {
    const owner = await registerClient(await connectClient(), "voice-owner");
    const member = await registerClient(await connectClient(), "voice-member");
    const outsider = { socket: await connectClient() };

    const created = (await emitWithAck(owner.socket, "guild:create", {
      name: "Voice Guild"
    })) as { ok: boolean; guild: { id: string }; invite?: { token: string } };
    expect(created.ok).toBe(true);
    expect(created.invite?.token).toEqual(expect.any(String));

    expect(
      await emitWithAck(member.socket, "guild:join-code", { code: created.invite?.token })
    ).toMatchObject({ ok: true });
    expect(await emitWithAck(owner.socket, "join-room", { guildId: created.guild.id })).toEqual({
      ok: true,
      guildId: created.guild.id
    });
    expect(await emitWithAck(member.socket, "join-room", { guildId: created.guild.id })).toEqual({
      ok: true,
      guildId: created.guild.id
    });

    const unauthorized = waitForEvent(member.socket, "webrtc-offer");
    outsider.socket.emit("webrtc-offer", {
      to: member.socket.id,
      sdp: { type: "offer", sdp: "v=0 outsider" }
    });
    await expect(unauthorized).resolves.toBeNull();

    const relayed = waitForEvent<{ from: string; sdp: { type: string } }>(
      member.socket,
      "webrtc-offer"
    );
    owner.socket.emit("webrtc-offer", {
      to: member.socket.id,
      sdp: { type: "offer", sdp: "v=0 guild" }
    });
    await expect(relayed).resolves.toMatchObject({
      from: owner.socket.id,
      sdp: { type: "offer" }
    });

    const answerRelayed = waitForEvent<{ from: string; sdp: { type: string } }>(
      owner.socket,
      "webrtc-answer"
    );
    member.socket.emit("webrtc-answer", {
      to: owner.socket.id,
      sdp: { type: "answer", sdp: "v=0 guild-answer" }
    });
    await expect(answerRelayed).resolves.toMatchObject({
      from: member.socket.id,
      sdp: { type: "answer" }
    });

    const iceRelayed = waitForEvent<{ from: string; candidate: { candidate: string } }>(
      owner.socket,
      "webrtc-ice"
    );
    member.socket.emit("webrtc-ice", {
      to: owner.socket.id,
      candidate: { candidate: "candidate:1 1 UDP 1 127.0.0.1 9 typ host" }
    });
    await expect(iceRelayed).resolves.toMatchObject({
      from: member.socket.id,
      candidate: { candidate: expect.stringContaining("candidate:1") }
    });
  });

  it("exposes persistent channels, role-protected moderation, and guild chat history", async () => {
    const owner = await registerClient(await connectClient(), "model-owner");
    const member = await registerClient(await connectClient(), "model-member");
    const created = (await emitWithAck(owner.socket, "guild:create", {
      name: "Model Guild"
    })) as any;
    expect(created.ok).toBe(true);
    await emitWithAck(member.socket, "guild:join-code", { code: created.invite.token });
    expect(
      await emitWithAck(owner.socket, "guild:channels", { guildId: created.guild.id })
    ).toMatchObject({
      ok: true,
      channels: expect.arrayContaining([
        expect.objectContaining({ type: "text" }),
        expect.objectContaining({ type: "voice" })
      ])
    });
    expect(
      await emitWithAck(owner.socket, "guild:create-channel", {
        guildId: created.guild.id,
        name: "announcements",
        type: "text"
      })
    ).toMatchObject({ ok: true, channel: expect.objectContaining({ name: "announcements" }) });
    await emitWithAck(owner.socket, "guild:select", { guildId: created.guild.id });
    await emitWithAck(member.socket, "guild:select", { guildId: created.guild.id });
    const categoryBroadcast = waitForEvent<any>(member.socket, "guild:channels");
    const categoryResult = (await emitWithAck(owner.socket, "guild:create-category", {
      guildId: created.guild.id,
      name: "Community"
    })) as any;
    expect(categoryResult).toMatchObject({ ok: true, category: { name: "Community" } });
    await expect(categoryBroadcast).resolves.toMatchObject({
      guildId: created.guild.id,
      categories: expect.arrayContaining([expect.objectContaining({ name: "Community" })])
    });
    const categoryUpdateBroadcast = waitForEvent<any>(member.socket, "guild:channels");
    expect(
      await emitWithAck(owner.socket, "guild:update-category", {
        guildId: created.guild.id,
        categoryId: categoryResult.category.id,
        name: "Community & Events"
      })
    ).toMatchObject({ ok: true, category: { name: "Community & Events" } });
    await expect(categoryUpdateBroadcast).resolves.toMatchObject({
      categories: expect.arrayContaining([expect.objectContaining({ name: "Community & Events" })])
    });
    const roleBroadcast = waitForEvent<any>(member.socket, "guild:members");
    expect(
      await emitWithAck(owner.socket, "guild:set-role", {
        guildId: created.guild.id,
        accountId: member.accountId,
        role: "moderator"
      })
    ).toEqual({ ok: true });
    await expect(roleBroadcast).resolves.toMatchObject({
      guildId: created.guild.id,
      members: expect.arrayContaining([
        expect.objectContaining({ accountId: member.accountId, role: "moderator" })
      ])
    });
    const memberDirectory = (await emitWithAck(owner.socket, "guild:members", {
      guildId: created.guild.id
    })) as any;
    const memberName = memberDirectory.members.find(
      (entry: any) => entry.accountId === member.accountId
    )?.username;
    expect(memberName).toBeTruthy();
    const mention = waitForEvent<any>(member.socket, "chat:mention");
    owner.socket.emit("chat-message", {
      guildId: created.guild.id,
      channelId: `${created.guild.id}:general`,
      text: `hello @${memberName}`
    });
    await expect(mention).resolves.toMatchObject({
      channelId: `${created.guild.id}:general`,
      text: `hello @${memberName}`
    });
    const message = waitForEvent<any>(owner.socket, "chat-message");
    owner.socket.emit("chat-message", {
      guildId: created.guild.id,
      channelId: `${created.guild.id}:general`,
      text: "persist me"
    });
    await expect(message).resolves.toMatchObject({
      text: "persist me",
      channelId: `${created.guild.id}:general`
    });
    const history = (await emitWithAck(owner.socket, "chat-history", {
      guildId: created.guild.id,
      channelId: `${created.guild.id}:general`
    })) as any;
    expect(history).toMatchObject({
      ok: true,
      messages: expect.arrayContaining([expect.objectContaining({ body: "persist me" })])
    });
    const parent = history.messages.find((entry: any) => entry.body === "persist me");
    expect(parent).toBeDefined();
    const reply = await emitWithAck(owner.socket, "chat-message", {
      guildId: created.guild.id,
      channelId: `${created.guild.id}:general`,
      text: "reply in the same channel",
      replyToId: parent.id
    });
    expect(reply).toMatchObject({
      ok: true,
      message: { replyToId: parent.id, channelId: `${created.guild.id}:general` }
    });
    const crossChannelReply = await emitWithAck(owner.socket, "chat-message", {
      guildId: created.guild.id,
      channelId: `${created.guild.id}:announcements`,
      text: "cross-channel reply must fail",
      replyToId: parent.id
    });
    expect(crossChannelReply).toMatchObject({ ok: false });
    expect(
      await emitWithAck(owner.socket, "chat-search", {
        guildId: created.guild.id,
        channelId: `${created.guild.id}:general`,
        query: "persist"
      })
    ).toMatchObject({
      ok: true,
      messages: expect.arrayContaining([expect.objectContaining({ body: "persist me" })])
    });
    const pinned = waitForEvent<any>(member.socket, "chat:pinned");
    const targetMessage = history.messages.find((entry: any) => entry.body === "persist me");
    expect(targetMessage).toBeDefined();
    expect(
      await emitWithAck(owner.socket, "chat-pin", {
        guildId: created.guild.id,
        messageId: targetMessage.id,
        pinned: true
      })
    ).toMatchObject({ ok: true });
    await expect(pinned).resolves.toMatchObject({ pinned: true });
    expect(
      await emitWithAck(owner.socket, "guild:moderate-member", {
        guildId: created.guild.id,
        accountId: member.accountId,
        action: "kick",
        reason: "test"
      })
    ).toEqual({ ok: true });
    expect(
      await emitWithAck(member.socket, "guild:channels", { guildId: created.guild.id })
    ).toMatchObject({ ok: false });
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
