/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import bcrypt from "bcryptjs";
import express from "express";
import {
  authCredentialsSchema,
  graphemeLength,
  registerCredentialsSchema
} from "@echoverse/contracts";
import { sanitizeEmail, sanitizeName, validEmail } from "../../domain/validation.js";
import type { Account } from "../../domain/types.js";
import {
  parseCookies,
  serializeCookie,
  type SessionManager,
  type SessionTokens
} from "../../auth/session.js";

const ACCESS_COOKIE = "echoverse_access";
const REFRESH_COOKIE = "echoverse_refresh";

type IdentityHttpConfig = {
  sessionAccessTtlSeconds: number;
  sessionRefreshTtlSeconds: number;
  webCookieSecure: boolean;
  webCookieSameSite: "lax" | "strict" | "none";
};

export type IdentityHttpDependencies = {
  app: express.Application;
  authRateLimit: express.RequestHandler;
  config: IdentityHttpConfig;
  sessionManager: SessionManager;
  accountByEmail(email: string): Promise<Account | null>;
  accountById(id: string): Promise<Account | null>;
  createAccount(email: string, username: string, passwordHash: string): Promise<Account>;
  usernameExists(username: string): Promise<boolean>;
  publicAccount(account: Account): Record<string, unknown>;
  httpError(req: express.Request, key: string, values?: Record<string, string | number>): string;
};

function sessionResponse(
  publicAccount: IdentityHttpDependencies["publicAccount"],
  account: Account,
  tokens: SessionTokens
) {
  return {
    token: tokens.accessToken,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    account: publicAccount(account)
  };
}

function setWebSessionCookies(
  res: express.Response,
  config: IdentityHttpConfig,
  tokens: SessionTokens
) {
  res.setHeader("Set-Cookie", [
    serializeCookie(ACCESS_COOKIE, tokens.accessToken, {
      maxAge: config.sessionAccessTtlSeconds,
      path: "/",
      secure: config.webCookieSecure,
      sameSite: config.webCookieSameSite
    }),
    serializeCookie(REFRESH_COOKIE, tokens.refreshToken, {
      maxAge: config.sessionRefreshTtlSeconds,
      path: "/auth",
      secure: config.webCookieSecure,
      sameSite: config.webCookieSameSite
    })
  ]);
}

function clearWebSessionCookies(res: express.Response, config: IdentityHttpConfig) {
  res.setHeader("Set-Cookie", [
    serializeCookie(ACCESS_COOKIE, "", {
      maxAge: 0,
      path: "/",
      secure: config.webCookieSecure,
      sameSite: config.webCookieSameSite
    }),
    serializeCookie(REFRESH_COOKIE, "", {
      maxAge: 0,
      path: "/auth",
      secure: config.webCookieSecure,
      sameSite: config.webCookieSameSite
    })
  ]);
}

function bearerToken(req: express.Request) {
  const authorization = req.get("Authorization") || "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
}

function requestAccessToken(req: express.Request) {
  return bearerToken(req) || parseCookies(req.headers.cookie).echoverse_access || "";
}

function requestRefreshToken(req: express.Request) {
  return String(req.body?.refreshToken || parseCookies(req.headers.cookie).echoverse_refresh || "");
}

function clientAuthResponse(
  req: express.Request,
  res: express.Response,
  config: IdentityHttpConfig,
  publicAccount: IdentityHttpDependencies["publicAccount"],
  account: Account,
  tokens: SessionTokens
) {
  if (req.get("X-EchoVerse-Client") === "desktop") {
    return res.json({ ok: true, ...sessionResponse(publicAccount, account, tokens) });
  }
  setWebSessionCookies(res, config, tokens);
  return res.json({ ok: true, account: publicAccount(account) });
}

/** Registers HTTP authentication routes and keeps browser credentials HttpOnly. */
export function registerIdentityHttpRoutes({
  app,
  authRateLimit,
  config,
  sessionManager,
  accountByEmail,
  accountById,
  createAccount,
  usernameExists,
  publicAccount,
  httpError
}: IdentityHttpDependencies) {
  app.use("/auth", authRateLimit);

  app.post("/auth/register", async (req, res) => {
    try {
      const parsed = registerCredentialsSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ ok: false, error: httpError(req, "server.registrationInvalid") });
        return;
      }

      const email = sanitizeEmail(parsed.data.email);
      const username = sanitizeName(parsed.data.username);
      if (!validEmail(email) || graphemeLength(username) < 3 || parsed.data.password.length < 6) {
        res.status(400).json({ ok: false, error: httpError(req, "server.registrationInvalid") });
        return;
      }
      if (await accountByEmail(email)) {
        res.status(409).json({ ok: false, error: httpError(req, "server.emailRegistered") });
        return;
      }
      if (await usernameExists(username)) {
        res.status(409).json({ ok: false, error: httpError(req, "server.usernameTaken") });
        return;
      }

      const account = await createAccount(
        email,
        username,
        await bcrypt.hash(parsed.data.password, 12)
      );
      return clientAuthResponse(
        req,
        res,
        config,
        publicAccount,
        account,
        sessionManager.issue(account.id)
      );
    } catch {
      console.error("echoverse.http.register_failed");
      res.status(500).json({ ok: false, error: httpError(req, "server.registrationFailed") });
    }
  });

  app.post("/auth/login", async (req, res) => {
    try {
      const parsed = authCredentialsSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(401).json({ ok: false, error: httpError(req, "server.invalidCredentials") });
        return;
      }

      const account = await accountByEmail(sanitizeEmail(parsed.data.email));
      if (!account || !(await bcrypt.compare(parsed.data.password, account.passwordHash))) {
        res.status(401).json({ ok: false, error: httpError(req, "server.invalidCredentials") });
        return;
      }

      return clientAuthResponse(
        req,
        res,
        config,
        publicAccount,
        account,
        sessionManager.issue(account.id)
      );
    } catch {
      console.error("echoverse.http.login_failed");
      res.status(500).json({ ok: false, error: httpError(req, "server.loginFailed") });
    }
  });

  app.post("/auth/refresh", async (req, res) => {
    const refreshToken = requestRefreshToken(req);
    const tokens = refreshToken ? sessionManager.rotate(refreshToken) : null;
    if (!tokens) {
      clearWebSessionCookies(res, config);
      res.status(401).json({ ok: false, error: httpError(req, "server.sessionRefreshFailed") });
      return;
    }

    const verified = sessionManager.verifyAccess(tokens.accessToken);
    const account = verified ? await accountById(verified.userId) : null;
    if (!account) {
      clearWebSessionCookies(res, config);
      res.status(401).json({ ok: false, error: httpError(req, "server.sessionRefreshFailed") });
      return;
    }

    return clientAuthResponse(req, res, config, publicAccount, account, tokens);
  });

  app.get("/auth/session", async (req, res) => {
    const verified = sessionManager.verifyAccess(requestAccessToken(req));
    const account = verified ? await accountById(verified.userId) : null;
    if (!account) {
      res.status(401).json({ ok: false, error: httpError(req, "server.sessionRequired") });
      return;
    }
    res.json({ ok: true, account: publicAccount(account) });
  });

  app.post("/auth/logout", (req, res) => {
    const accessToken = requestAccessToken(req);
    const refreshToken = requestRefreshToken(req);
    if (accessToken) sessionManager.revokeAccess(accessToken);
    if (refreshToken) sessionManager.revokeRefresh(refreshToken);
    clearWebSessionCookies(res, config);
    res.json({ ok: true });
  });
}
