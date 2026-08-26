/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { describe, expect, it } from "vitest";
import { loadServerConfig } from "./index.js";

describe("server configuration", () => {
  it("fails closed for production without a strong secret", () => {
    expect(() => loadServerConfig({ NODE_ENV: "production" })).toThrow(/JWT_SECRET/);
  });

  it("uses explicit origins and an ephemeral development secret", () => {
    const config = loadServerConfig({ NODE_ENV: "development", CORS_ORIGINS: "https://example.test" });
    expect(config.corsOrigins).toEqual(["https://example.test"]);
    expect(config.jwtSecret.length).toBeGreaterThanOrEqual(32);
  });

  it("rejects invalid ports", () => {
    expect(() => loadServerConfig({ PORT: "70000" })).toThrow(/PORT/);
  });
});
