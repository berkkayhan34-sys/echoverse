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
    const config = loadServerConfig({
      NODE_ENV: "development",
      CORS_ORIGINS: "https://example.test"
    });
    expect(config.corsOrigins).toEqual(["https://example.test"]);
    expect(config.jwtSecret.length).toBeGreaterThanOrEqual(32);
    expect(config.databaseSslRejectUnauthorized).toBe(true);
  });

  it("allows hosted providers with self-signed database certificates to opt out explicitly", () => {
    const config = loadServerConfig({
      NODE_ENV: "production",
      JWT_SECRET: "x".repeat(32),
      DATABASE_SSL_REJECT_UNAUTHORIZED: "false"
    });
    expect(config.databaseSslRejectUnauthorized).toBe(false);
  });

  it("rejects invalid ports", () => {
    expect(() => loadServerConfig({ PORT: "70000" })).toThrow(/PORT/);
    expect(() => loadServerConfig({ PORT: "0" })).toThrow(/PORT/);
  });

  it("trims database URLs and ignores blank origin entries", () => {
    const config = loadServerConfig({
      DATABASE_URL: " postgres://example.test/db ",
      CORS_ORIGINS: " https://one.example, ,https://two.example "
    });
    expect(config.databaseUrl).toBe("postgres://example.test/db");
    expect(config.corsOrigins).toEqual(["https://one.example", "https://two.example"]);
  });
});
