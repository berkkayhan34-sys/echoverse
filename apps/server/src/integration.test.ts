/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { io as createClient, type Socket } from "socket.io-client";
import { safeErrorResponseSchema } from "@echoverse/contracts";
import { httpServer } from "./index.js";

type AckResponse = { ok: boolean; error?: string; [key: string]: unknown };

let baseUrl = "";
const clients: Socket[] = [];

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
