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
  supportedProtocolVersions,
  createEnvelope,
  registerCredentialsSchema,
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

  it("bounds attachment payloads", () => {
    expect(
      attachmentSchema.safeParse({ name: "x.txt", mime: "text/plain", data: "not-data" }).success
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
});
