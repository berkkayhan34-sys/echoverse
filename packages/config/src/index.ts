/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import crypto from "node:crypto";

const localOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];

function csv(value: string | undefined, fallback: string[]) {
  const values = (value || "").split(",").map(item => item.trim()).filter(Boolean);
  return values.length ? values : fallback;
}

export type ServerConfig = {
  nodeEnv: "development" | "test" | "production";
  port: number;
  databaseUrl?: string;
  databaseSslRejectUnauthorized: boolean;
  jwtSecret: string;
  corsOrigins: string[];
};

export function loadServerConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const nodeEnv = env.NODE_ENV === "production" ? "production" : env.NODE_ENV === "test" ? "test" : "development";
  const jwtSecret = env.JWT_SECRET?.trim();
  const port = Number(env.PORT || 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error("PORT must be a valid TCP port");
  if (nodeEnv === "production" && (!jwtSecret || jwtSecret.length < 32)) {
    throw new Error("JWT_SECRET must be set to at least 32 characters in production");
  }

  const databaseSslRejectUnauthorized = env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false";

  return {
    nodeEnv,
    port,
    databaseUrl: env.DATABASE_URL?.trim() || undefined,
    databaseSslRejectUnauthorized,
    jwtSecret: jwtSecret || crypto.randomBytes(32).toString("hex"),
    corsOrigins: csv(env.CORS_ORIGINS, localOrigins)
  };
}
