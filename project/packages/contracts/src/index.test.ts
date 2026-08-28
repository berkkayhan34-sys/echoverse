/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { describe, expect, it } from "vitest";
import {
  PROTOCOL_VERSION,
  attachmentMetadataSchema,
  attachmentSchema,
  chatMessageSchema,
  isSupportedProtocolVersion,
  paginationSchema,
  protocolEnvelopeSchema,
  protocolReadySchema,
  protocolVersionSchema,
  safeErrorResponseSchema,
  socketEventPayloadSchemas,
  supportedProtocolVersions,
  createEnvelope,
  graphemeLength,
  registerCredentialsSchema,
  truncateGraphemes,
  webrtcDescriptionEventSchema,
  webrtcDescriptionSchema,
  webrtcIceCandidateSchema
} from "./index.js";

describe("protocol contracts", () => {
  it("creates version 2 envelopes", () => {
    const envelope = createEnvelope("health", { ok: true });
    expect(envelope.v).toBe(PROTOCOL_VERSION);
    expect(envelope.event).toBe("health");
    expect(protocolEnvelopeSchema.safeParse(envelope).success).toBe(true);
    expect(protocolEnvelopeSchema.safeParse({ ...envelope, extra: true }).success).toBe(false);
    expect(protocolEnvelopeSchema.safeParse({ ...envelope, v: 1 }).success).toBe(false);
    expect(protocolEnvelopeSchema.safeParse({ ...envelope, sentAt: "not-a-date" }).success).toBe(
      false
    );
    expect(protocolReadySchema.safeParse({ version: PROTOCOL_VERSION }).success).toBe(true);
    expect(protocolVersionSchema.safeParse(PROTOCOL_VERSION).success).toBe(true);
    expect(protocolVersionSchema.safeParse(256).success).toBe(false);
    expect(supportedProtocolVersions).toEqual([PROTOCOL_VERSION]);
    expect(isSupportedProtocolVersion(PROTOCOL_VERSION)).toBe(true);
    expect(isSupportedProtocolVersion(1)).toBe(false);
  });

  it("rejects unsafe registration input", () => {
    expect(
      registerCredentialsSchema.safeParse({
        email: "a@b.com",
        username: "<script>",
        password: "secret123"
      }).success
    ).toBe(false);
  });

  it("validates and truncates Unicode usernames by grapheme cluster", () => {
    const username = "İpek🙂漢字ı̆";
    expect(
      registerCredentialsSchema.safeParse({
        email: "unicode@example.com",
        username,
        password: "secret123"
      }).success
    ).toBe(true);
    expect(graphemeLength("🙂ı̆漢")).toBe(3);
    expect(truncateGraphemes("🙂ı̆漢字", 3)).toBe("🙂ı̆漢");
    expect(
      registerCredentialsSchema.safeParse({
        email: "invalid@example.com",
        username: "🙂🙂",
        password: "secret123"
      }).success
    ).toBe(false);
  });

  it("bounds attachment payloads", () => {
    expect(
      attachmentSchema.safeParse({ name: "x.txt", mime: "text/plain", data: "not-data" }).success
    ).toBe(false);
    expect(
      attachmentSchema.safeParse({
        name: "x.txt",
        mime: "text/plain",
        data: "data:text/plain;base64,SGVsbG8="
      }).success
    ).toBe(true);
    expect(
      attachmentSchema.safeParse({
        name: "x.exe",
        mime: "application/x-msdownload",
        data: "data:application/x-msdownload;base64,SGVsbG8="
      }).success
    ).toBe(false);
    expect(
      attachmentSchema.safeParse({
        name: "x.txt",
        mime: "text/plain",
        data: "data:image/png;base64,SGVsbG8="
      }).success
    ).toBe(false);
    expect(attachmentMetadataSchema.safeParse({ name: "x.txt", mime: "text/plain" }).success).toBe(
      true
    );
    expect(
      attachmentMetadataSchema.safeParse({ name: "x.txt", mime: "text/plain", data: "x" }).success
    ).toBe(false);
  });

  it("bounds chat event payloads", () => {
    expect(chatMessageSchema.parse({ guildId: "guild", text: "  hello  " })).toEqual({
      guildId: "guild",
      text: "hello"
    });
    expect(chatMessageSchema.safeParse({ guildId: "guild", text: "x".repeat(2501) }).success).toBe(
      false
    );
  });

  it("normalizes bounded pagination defaults and rejects oversized cursors", () => {
    expect(paginationSchema.parse({})).toEqual({ limit: 50 });
    expect(paginationSchema.safeParse({ limit: 101 }).success).toBe(false);
    expect(paginationSchema.safeParse({ cursor: "x".repeat(201) }).success).toBe(false);
  });

  it("accepts safe errors and rejects secret-bearing extra fields", () => {
    expect(safeErrorResponseSchema.safeParse({ ok: false, error: "Oturum gerekli." }).success).toBe(
      true
    );
    expect(
      safeErrorResponseSchema.safeParse({ ok: false, error: "failed", stack: "private" }).success
    ).toBe(false);
  });

  it("shares the same bounded WebRTC fixtures for both clients", () => {
    const description = {
      to: "peer-socket",
      sdp: { type: "offer", sdp: "v=0\\r\\n" }
    } as const;
    const candidate = {
      to: "peer-socket",
      candidate: { candidate: "candidate:1 1 UDP 1 127.0.0.1 9 typ host" }
    } as const;

    expect(webrtcDescriptionSchema.safeParse(description).success).toBe(true);
    expect(
      webrtcDescriptionEventSchema.safeParse({ from: "peer-socket", sdp: description.sdp }).success
    ).toBe(true);
    expect(webrtcIceCandidateSchema.safeParse(candidate).success).toBe(true);
    expect(
      webrtcIceCandidateSchema.safeParse({ ...candidate, candidate: { candidate: "" } }).success
    ).toBe(false);
    expect(
      webrtcDescriptionSchema.safeParse({
        ...description,
        sdp: { ...description.sdp, extra: true }
      }).success
    ).toBe(false);
  });

  it("strictly validates every Socket.IO event payload", () => {
    const expectedEvents = [
      "auth:register",
      "auth:login",
      "auth:resume",
      "auth:logout",
      "profile:set-avatar",
      "identify",
      "friends:search",
      "friends:list",
      "friends:request",
      "friends:respond",
      "friends:remove",
      "friends:block",
      "friends:unblock",
      "dm:history",
      "dm:send",
      "dm:edit",
      "dm:delete",
      "call:start",
      "call:answer",
      "call:end",
      "guild:create",
      "guild:create-invite",
      "guild:join-code",
      "guild:revoke-invite",
      "guild:set-role",
      "guild:rename-lobby",
      "guild:leave",
      "guild:select",
      "join-room",
      "voice:sync-request",
      "leave-room",
      "chat-message",
      "spotify:party-start",
      "spotify:party-stop",
      "spotify:sync",
      "webrtc-offer",
      "webrtc-answer",
      "webrtc-ice",
      "presence:set",
      "presence:get",
      "dm:typing",
      "dm:read",
      "dm:react"
    ];

    expect(Object.keys(socketEventPayloadSchemas).sort()).toEqual(expectedEvents.sort());
    expect(
      socketEventPayloadSchemas["friends:search"].safeParse({ query: "ok", extra: true }).success
    ).toBe(false);
    expect(
      socketEventPayloadSchemas["dm:send"].safeParse({ friendId: "x", body: "x", attachment: null })
        .success
    ).toBe(true);
    expect(
      socketEventPayloadSchemas["guild:rename-lobby"].safeParse({
        guildId: "guild",
        name: "Quiet Room"
      }).success
    ).toBe(true);
    expect(
      socketEventPayloadSchemas["guild:rename-lobby"].safeParse({
        guildId: "guild",
        name: ""
      }).success
    ).toBe(false);
    expect(
      socketEventPayloadSchemas["spotify:sync"].safeParse({
        guildId: "guild",
        state: { albumImage: "", timestamp: Date.now() }
      }).success
    ).toBe(true);
  });
});
