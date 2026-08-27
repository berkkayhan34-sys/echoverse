/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { io as createClient, type Socket } from "socket.io-client";
import { safeErrorResponseSchema } from "@echoverse/contracts";
import { httpServer } from "./index.js";

type AckResponse = { ok: boolean; error?: string; [key: string]: unknown };

let baseUrl = "";
const clients: Socket[] = [];
let fixtureSequence = 0;

function emitWithAck(socket: Socket, event: string, payload: unknown): Promise<AckResponse> {
  return new Promise((resolve) => {
    socket.emit(event, payload, (response: AckResponse) => resolve(response));
  });
}

function connectClient(protocolVersion = 2) {
  const socket = createClient(baseUrl, {
    auth: { protocolVersion },
    transports: ["websocket"],
    reconnection: false
  });
  clients.push(socket);
  return new Promise<Socket>((resolve, reject) => {
    socket.once("connect", () => resolve(socket));
    socket.once("connect_error", reject);
  });
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
  });

  it("returns versioned health data with security headers", async () => {
    const response = await fetch(`${baseUrl}/health`);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, protocolVersion: 2 });
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("SAMEORIGIN");
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
    await expect(connectClient(1)).rejects.toThrow(/Unsupported protocol version/);
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
    const client = await connectClient();
    const response = await emitWithAck(client, "friends:list", null);
    expect(safeErrorResponseSchema.safeParse(response).success).toBe(true);
    expect(response.error).toBe("Oturum gerekli.");
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
    expect(response).toEqual({ ok: false, error: "Arkadaş değilsiniz." });

    const history = await emitWithAck(sender, "dm:history", { friendId: recipientAccount.id });
    expect(history).toEqual({ ok: false, error: "Arkadaş değilsiniz." });
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

    expect(response).toEqual({ ok: false, error: "Dosya verisi geçersiz." });
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

  it("enforces the per-socket authentication rate limit", async () => {
    const client = await connectClient();
    const responses: AckResponse[] = [];
    for (let index = 0; index < 9; index += 1) {
      responses.push(await emitWithAck(client, "auth:register", null));
    }

    expect(
      responses.slice(0, 8).every((response) => response.error === "Kayıt bilgileri geçersiz.")
    ).toBe(true);
    expect(responses[8]).toMatchObject({ ok: false });
    expect(responses[8].error).toMatch(/Çok fazla deneme/);
  });
});
