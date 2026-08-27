/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { describe, expect, it } from "vitest";
import { sanitizeEmail, sanitizeName, sanitizeText, validEmail } from "./validation.js";

describe("server input validators", () => {
  it("normalizes names and bounds them without losing Unicode characters", () => {
    expect(sanitizeName("  Echo   Verse  ")).toBe("Echo Verse");
    expect(sanitizeName("ğ".repeat(40), 3)).toBe("ğğğ");
  });

  it("normalizes and bounds message text", () => {
    expect(sanitizeText("  hello  ")).toBe("hello");
    expect(sanitizeText("x".repeat(2501))).toHaveLength(2500);
    expect(sanitizeText(null)).toBe("");
  });

  it("canonicalizes email input and rejects malformed addresses", () => {
    expect(sanitizeEmail("  USER@Example.COM ")).toBe("user@example.com");
    expect(sanitizeEmail("x".repeat(170))).toHaveLength(160);
    expect(validEmail("user@example.com")).toBe(true);
    expect(validEmail("user@example")).toBe(false);
  });
});
