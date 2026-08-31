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
    expect(config.databaseSsl).toBe(false);
    expect(config.databaseSslRejectUnauthorized).toBe(true);
    expect(config.webCookieSecure).toBe(false);
    expect(config.webCookieSameSite).toBe("lax");
    expect(config.trustProxy).toBe(false);
    expect(config.sessionAccessTtlSeconds).toBe(900);
    expect(config.sessionRefreshTtlSeconds).toBe(604800);
  });

  it("allows hosted providers with self-signed database certificates to opt out explicitly", () => {
    const config = loadServerConfig({
      NODE_ENV: "production",
      JWT_SECRET: "x".repeat(32),
      DATABASE_SSL_REJECT_UNAUTHORIZED: "false"
    });
    expect(config.databaseSslRejectUnauthorized).toBe(false);
  });

  it("allows local PostgreSQL to disable TLS explicitly while production defaults stay secure", () => {
    const localConfig = loadServerConfig({
      NODE_ENV: "production",
      JWT_SECRET: "x".repeat(32),
      DATABASE_SSL: "false"
    });
    expect(localConfig.databaseSsl).toBe(false);
    expect(
      loadServerConfig({ NODE_ENV: "production", JWT_SECRET: "x".repeat(32) }).databaseSsl
    ).toBe(true);
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
    expect(config.sqlitePath).toBeUndefined();
    expect(config.corsOrigins).toEqual(["https://one.example", "https://two.example"]);
  });

  it("supports one explicit local SQLite path and rejects mixed database modes", () => {
    const config = loadServerConfig({ SQLITE_PATH: " ./data/echoverse.sqlite " });
    expect(config.sqlitePath).toBe("./data/echoverse.sqlite");
    expect(() =>
      loadServerConfig({ DATABASE_URL: "postgres://example.test/db", SQLITE_PATH: "local.db" })
    ).toThrow(/cannot be configured together/);
  });

  it("loads explicit proxy, cookie, and session lifetime settings", () => {
    const config = loadServerConfig({
      NODE_ENV: "production",
      JWT_SECRET: "x".repeat(32),
      TRUST_PROXY: "true",
      WEB_COOKIE_SECURE: "true",
      SESSION_ACCESS_TTL_SECONDS: "600",
      SESSION_REFRESH_TTL_SECONDS: "86400"
    });

    expect(config.trustProxy).toBe(true);
    expect(config.webCookieSecure).toBe(true);
    expect(config.webCookieSameSite).toBe("none");
    expect(config.sessionAccessTtlSeconds).toBe(600);
    expect(config.sessionRefreshTtlSeconds).toBe(86400);
  });

  it("rejects insecure production cookies and malformed booleans", () => {
    expect(() =>
      loadServerConfig({
        NODE_ENV: "production",
        JWT_SECRET: "x".repeat(32),
        WEB_COOKIE_SECURE: "false"
      })
    ).toThrow(/WEB_COOKIE_SECURE/);
    expect(() => loadServerConfig({ TRUST_PROXY: "yes" })).toThrow(/TRUST_PROXY/);
    expect(() => loadServerConfig({ WEB_COOKIE_SAMESITE: "none" })).toThrow(/WEB_COOKIE_SECURE/);
    expect(() => loadServerConfig({ WEB_COOKIE_SAMESITE: "invalid" })).toThrow(
      /WEB_COOKIE_SAMESITE/
    );
  });
});
