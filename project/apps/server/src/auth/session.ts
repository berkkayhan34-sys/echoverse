/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import crypto from "node:crypto";
import jwt from "jsonwebtoken";

export type SessionTokens = {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  accessExpiresAt: number;
  refreshExpiresAt: number;
};

export type VerifiedAccess = {
  userId: string;
  sessionId: string;
  expiresAt: number;
};

type SessionRecord = {
  sessionId: string;
  familyId: string;
  userId: string;
  refreshTokenHash: string;
  accessExpiresAt: number;
  refreshExpiresAt: number;
  revokedAt: number | null;
};

type SessionManagerOptions = {
  jwtSecret: string;
  accessTtlSeconds: number;
  refreshTtlSeconds: number;
  now?: () => number;
};

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function newRefreshToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export class SessionManager {
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly jwtSecret: string;
  private readonly accessTtlSeconds: number;
  private readonly refreshTtlSeconds: number;
  private readonly now: () => number;

  constructor(options: SessionManagerOptions) {
    this.jwtSecret = options.jwtSecret;
    this.accessTtlSeconds = options.accessTtlSeconds;
    this.refreshTtlSeconds = options.refreshTtlSeconds;
    this.now = options.now || Date.now;
  }

  issue(userId: string): SessionTokens {
    return this.issueInFamily(userId, crypto.randomUUID());
  }

  private issueInFamily(userId: string, familyId: string): SessionTokens {
    const issuedAt = this.now();
    const accessExpiresAt = issuedAt + this.accessTtlSeconds * 1000;
    const refreshExpiresAt = issuedAt + this.refreshTtlSeconds * 1000;
    const sessionId = crypto.randomUUID();
    const refreshToken = newRefreshToken();

    this.sessions.set(sessionId, {
      sessionId,
      familyId,
      userId,
      refreshTokenHash: hashToken(refreshToken),
      accessExpiresAt,
      refreshExpiresAt,
      revokedAt: null
    });

    const accessToken = jwt.sign({ sub: userId, sid: sessionId, typ: "access" }, this.jwtSecret, {
      expiresIn: this.accessTtlSeconds
    });

    return { accessToken, refreshToken, sessionId, accessExpiresAt, refreshExpiresAt };
  }

  verifyAccess(accessToken: string): VerifiedAccess | null {
    try {
      const decoded = jwt.verify(accessToken, this.jwtSecret) as jwt.JwtPayload;
      const userId = typeof decoded.sub === "string" ? decoded.sub : "";
      const sessionId = typeof decoded.sid === "string" ? decoded.sid : "";
      const expiresAt = typeof decoded.exp === "number" ? decoded.exp * 1000 : 0;
      const record = this.sessions.get(sessionId);
      const now = this.now();

      if (
        decoded.typ !== "access" ||
        !userId ||
        !sessionId ||
        !record ||
        record.userId !== userId ||
        record.revokedAt !== null ||
        record.accessExpiresAt <= now ||
        expiresAt <= now
      ) {
        return null;
      }

      return { userId, sessionId, expiresAt };
    } catch {
      return null;
    }
  }

  rotate(refreshToken: string): SessionTokens | null {
    const hash = hashToken(refreshToken);
    const record = [...this.sessions.values()].find(
      (candidate) => candidate.refreshTokenHash === hash
    );
    const now = this.now();

    if (!record) {
      return null;
    }

    if (record.revokedAt !== null) {
      this.revokeFamily(record.familyId);
      return null;
    }
    if (record.refreshExpiresAt <= now) return null;

    record.revokedAt = now;
    const next = this.issueInFamily(record.userId, record.familyId);
    return next;
  }

  revokeAccess(accessToken: string) {
    const verified = this.verifyAccess(accessToken);
    if (!verified) return false;
    return this.revokeSession(verified.sessionId);
  }

  revokeRefresh(refreshToken: string) {
    const hash = hashToken(refreshToken);
    const record = [...this.sessions.values()].find(
      (candidate) => candidate.refreshTokenHash === hash
    );
    if (!record) return false;
    return this.revokeSession(record.sessionId);
  }

  revokeSession(sessionId: string) {
    const record = this.sessions.get(sessionId);
    if (!record || record.revokedAt !== null) return false;
    record.revokedAt = this.now();
    return true;
  }

  private revokeFamily(familyId: string) {
    const now = this.now();
    for (const record of this.sessions.values()) {
      if (record.familyId === familyId && record.revokedAt === null) record.revokedAt = now;
    }
  }

  activeSessionCount() {
    return [...this.sessions.values()].filter((record) => record.revokedAt === null).length;
  }
}

export function parseCookies(header: string | undefined) {
  const cookies: Record<string, string> = {};
  for (const part of String(header || "").split(";")) {
    const separator = part.indexOf("=");
    if (separator <= 0) continue;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (!name) continue;
    try {
      cookies[name] = decodeURIComponent(value);
    } catch {
      cookies[name] = value;
    }
  }
  return cookies;
}

export function serializeCookie(
  name: string,
  value: string,
  options: {
    maxAge: number;
    path: string;
    secure: boolean;
    sameSite: "lax" | "strict" | "none";
  }
) {
  const attributes = [
    `${name}=${encodeURIComponent(value)}`,
    `Max-Age=${Math.max(0, Math.floor(options.maxAge))}`,
    `Path=${options.path}`,
    "HttpOnly",
    `SameSite=${options.sameSite[0].toUpperCase()}${options.sameSite.slice(1)}`
  ];
  if (options.secure) attributes.push("Secure");
  return attributes.join("; ");
}
