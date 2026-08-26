/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { describe, expect, it } from "vitest";
import { PROTOCOL_VERSION, attachmentSchema, createEnvelope, registerCredentialsSchema } from "./index.js";

describe("protocol contracts", () => {
  it("creates version 2 envelopes", () => {
    const envelope = createEnvelope("health", { ok: true });
    expect(envelope.v).toBe(PROTOCOL_VERSION);
    expect(envelope.event).toBe("health");
  });

  it("rejects unsafe registration input", () => {
    expect(registerCredentialsSchema.safeParse({ email: "a@b.com", username: "<script>", password: "secret123" }).success).toBe(false);
  });

  it("bounds attachment payloads", () => {
    expect(attachmentSchema.safeParse({ name: "x.txt", mime: "text/plain", data: "not-data" }).success).toBe(false);
  });
});
