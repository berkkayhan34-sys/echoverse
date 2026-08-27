/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import crypto from "node:crypto";

const localOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];

function csv(value: string | undefined, fallback: string[]) {
  const values = (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return values.length ? values : fallback;
}

function positiveInteger(value: string | undefined, fallback: number, name: string) {
  const parsed = Number(value || fallback);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function booleanValue(value: string | undefined, fallback: boolean, name: string) {
  if (value === undefined) return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${name} must be true or false`);
}

export type ServerConfig = {
  nodeEnv: "development" | "test" | "production";
  port: number;
  databaseUrl?: string;
  sqlitePath?: string;
  databaseSslRejectUnauthorized: boolean;
  jwtSecret: string;
  corsOrigins: string[];
  trustProxy: boolean;
  webCookieSecure: boolean;
  webCookieSameSite: "lax" | "strict" | "none";
  sessionAccessTtlSeconds: number;
  sessionRefreshTtlSeconds: number;
};

export function loadServerConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const nodeEnv =
    env.NODE_ENV === "production" ? "production" : env.NODE_ENV === "test" ? "test" : "development";
  const jwtSecret = env.JWT_SECRET?.trim();
  const port = Number(env.PORT || 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65_535)
    throw new Error("PORT must be a valid TCP port");
  if (nodeEnv === "production" && (!jwtSecret || jwtSecret.length < 32)) {
    throw new Error("JWT_SECRET must be set to at least 32 characters in production");
  }

  const databaseUrl = env.DATABASE_URL?.trim() || undefined;
  const sqlitePath = env.SQLITE_PATH?.trim() || undefined;
  if (databaseUrl && sqlitePath) {
    throw new Error("DATABASE_URL and SQLITE_PATH cannot be configured together");
  }

  const databaseSslRejectUnauthorized = env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false";
  const trustProxy = booleanValue(env.TRUST_PROXY, false, "TRUST_PROXY");
  const webCookieSecure = booleanValue(
    env.WEB_COOKIE_SECURE,
    nodeEnv === "production",
    "WEB_COOKIE_SECURE"
  );
  if (nodeEnv === "production" && !webCookieSecure) {
    throw new Error("WEB_COOKIE_SECURE must be true in production");
  }
  const webCookieSameSite = (env.WEB_COOKIE_SAMESITE || (nodeEnv === "production" ? "none" : "lax"))
    .trim()
    .toLowerCase();
  if (!(
    webCookieSameSite === "lax" ||
    webCookieSameSite === "strict" ||
    webCookieSameSite === "none"
  )) {
    throw new Error("WEB_COOKIE_SAMESITE must be lax, strict, or none");
  }
  if (webCookieSameSite === "none" && !webCookieSecure) {
    throw new Error("WEB_COOKIE_SAMESITE=none requires WEB_COOKIE_SECURE=true");
  }

  return {
    nodeEnv,
    port,
    databaseUrl,
    sqlitePath,
    databaseSslRejectUnauthorized,
    jwtSecret: jwtSecret || crypto.randomBytes(32).toString("hex"),
    corsOrigins: csv(env.CORS_ORIGINS, localOrigins),
    trustProxy,
    webCookieSecure,
    webCookieSameSite,
    sessionAccessTtlSeconds: positiveInteger(
      env.SESSION_ACCESS_TTL_SECONDS,
      900,
      "SESSION_ACCESS_TTL_SECONDS"
    ),
    sessionRefreshTtlSeconds: positiveInteger(
      env.SESSION_REFRESH_TTL_SECONDS,
      604_800,
      "SESSION_REFRESH_TTL_SECONDS"
    )
  };
}
