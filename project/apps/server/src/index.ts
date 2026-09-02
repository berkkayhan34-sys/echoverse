import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createRequire } from "node:module";
import { dirname, extname, resolve } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadServerConfig } from "@echoverse/config";
import {
  PROTOCOL_VERSION,
  createTranslator,
  resolveLocale,
  socketEventPayloadSchemas,
  type Locale
} from "@echoverse/contracts";
import { createPersistenceRuntime } from "./persistence/runtime.js";
import { createRetentionService } from "./persistence/retention.js";
import { sanitizeName, sanitizeText } from "./domain/validation.js";
import type { Account, StoredDm, User } from "./domain/types.js";
import { registerChatHandlers } from "./features/chat/handlers.js";
import { createGuildChatService } from "./features/chat/guild-service.js";
import { createAccountService } from "./features/identity/accounts.js";
import { registerIdentityHandlers } from "./features/identity/handlers.js";
import { registerIdentityHttpRoutes } from "./features/identity/http.js";
import { createFriendService } from "./features/friends/service.js";
import { createGuildService } from "./features/guilds/service.js";
import { registerCallHandlers } from "./features/calls/handlers.js";
import { registerGuildHandlers } from "./features/guilds/handlers.js";
import { registerFriendHandlers } from "./features/friends/handlers.js";
import { createGuildNotificationService } from "./features/notifications/service.js";
import { registerGuildNotificationHandlers } from "./features/notifications/handlers.js";
import {
  allowSocketEvent,
  clearSocketLimits,
  socketEventLimit,
  socketPayloadWithinLimit
} from "./runtime/limits.js";
import { parseCookies, SessionManager } from "./auth/session.js";
import {
  accountPresence,
  activeCalls,
  activeGroupCalls,
  dmReadAt,
  guilds,
  guildMembers,
  guildRoles,
  guildChannels,
  guildCategories,
  guildPermissionOverrides,
  guildModeration,
  guildAuditEvents,
  guildInvites,
  memoryAccounts,
  memoryDmConversations,
  memoryDmMessages,
  memoryDmRequests,
  memoryDmPeerPreferences,
  memoryDmPrivacy,
  memoryDmReports,
  memoryGuildMessages,
  memoryGuildChannelUserState,
  memoryFriendships,
  pendingCalls,
  users
} from "./runtime/state.js";
import { createCorrelationId, serverLogger, serverMetrics } from "./runtime/observability.js";

const require = createRequire(import.meta.url);
const APP_VERSION = String(require("../package.json").version);
const config = loadServerConfig();
// The self-hosted service runs from the server workspace while the web build
// is emitted to the repository-level temporary directory. Keep this path
// deterministic and allow an explicit override for packaged/alternative
// deployments without coupling the server to a particular checkout path.
const webDistPath =
  process.env.ECHO_VERSE_WEB_DIST_DIR?.trim() ||
  resolve(dirname(fileURLToPath(import.meta.url)), "../../../../tmp/generated/web");
const webIndexPath = resolve(webDistPath, "index.html");
const translators = {
  en: createTranslator("en"),
  tr: createTranslator("tr")
} as const;

function resolveRequestLocale(value: unknown): Locale {
  // Missing locale preserves the pre-localization Turkish response contract;
  // explicit unsupported locales resolve deterministically to English.
  return typeof value === "string" && value.trim() ? resolveLocale(value) : "tr";
}

function requestLocale(req: express.Request): Locale {
  return resolveRequestLocale(req.get("X-EchoVerse-Locale") || req.get("Accept-Language"));
}

function localized(locale: Locale, key: string, values: Record<string, string | number> = {}) {
  return translators[locale](key, values);
}

function socketError(socket: any, key: string, values: Record<string, string | number> = {}) {
  return localized(resolveRequestLocale(socket.data.locale), key, values);
}

function httpError(
  req: express.Request,
  key: string,
  values: Record<string, string | number> = {}
) {
  return localized(requestLocale(req), key, values);
}

const app = express();
app.disable("x-powered-by");
// Render terminates TLS through one trusted proxy hop. A numeric hop count
// preserves the client IP for rate limiting without permitting arbitrary
// forwarded headers as `trust proxy=true` would.
app.set("trust proxy", config.trustProxy ? 1 : 0);
app.use((req, res, next) => {
  const correlationId = createCorrelationId(req.get("X-EchoVerse-Request-ID"));
  const startedAt = performance.now();
  res.locals.correlationId = correlationId;
  res.setHeader("X-EchoVerse-Request-ID", correlationId);
  serverMetrics.increment("http.requests.started");
  res.on("finish", () => {
    const statusClass = `${Math.floor(res.statusCode / 100)}xx`;
    serverMetrics.increment(`http.responses.${statusClass}`);
    serverMetrics.observe("http.request_duration_ms", performance.now() - startedAt);
    serverLogger.info("echoverse.http.request_completed", {
      correlationId,
      method: req.method,
      status: res.statusCode,
      durationMs: Math.round(performance.now() - startedAt)
    });
  });
  next();
});
app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || config.corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("origin_not_allowed"));
    },
    credentials: true
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(
  rateLimit({
    windowMs: 60_000,
    limit: 240,
    standardHeaders: true,
    legacyHeaders: false
  })
);

app.get("/", (_req, res, next) => {
  if (existsSync(webIndexPath)) {
    res.sendFile(webIndexPath, (error) => {
      if (error) next(error);
    });
    return;
  }

  res.json({
    name: "EchoVerse Server",
    version: APP_VERSION,
    protocolVersion: PROTOCOL_VERSION,
    ok: true,
    database: config.databaseUrl ? "postgres" : config.sqlitePath ? "sqlite" : "memory",
    time: new Date().toISOString()
  });
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    version: APP_VERSION,
    protocolVersion: PROTOCOL_VERSION,
    database: config.databaseUrl ? "postgres" : config.sqlitePath ? "sqlite" : "memory",
    metrics: serverMetrics.snapshot()
  });
});

const httpServer = http.createServer(app);
httpServer.requestTimeout = 15_000;
httpServer.headersTimeout = 10_000;
httpServer.keepAliveTimeout = 5_000;

const io = new Server(httpServer, {
  cors: { origin: config.corsOrigins, credentials: true, methods: ["GET", "POST"] },
  transports: ["websocket", "polling"],
  maxHttpBufferSize: 8e6
});

const sessionManager = new SessionManager({
  jwtSecret: config.jwtSecret,
  accessTtlSeconds: config.sessionAccessTtlSeconds,
  refreshTtlSeconds: config.sessionRefreshTtlSeconds
});

io.use(async (socket, next) => {
  socket.data.locale = resolveRequestLocale(
    socket.handshake.auth?.locale ||
      socket.handshake.headers["x-echoverse-locale"] ||
      socket.handshake.headers["accept-language"]
  );
  const requested = Number(socket.handshake.auth?.protocolVersion);
  if (requested !== PROTOCOL_VERSION) {
    next(
      new Error(
        socketError(socket, "server.protocolUnsupported", {
          version: requested
        })
      )
    );
    return;
  }

  const authToken = String(
    socket.handshake.auth?.accessToken ||
      parseCookies(socket.handshake.headers.cookie).echoverse_access ||
      ""
  );

  if (authToken) {
    const verified = sessionManager.verifyAccess(authToken);
    if (!verified) {
      next(new Error(socketError(socket, "server.invalidSession")));
      return;
    }

    const account = await accountById(verified.userId);
    if (!account) {
      next(new Error(socketError(socket, "server.invalidSession")));
      return;
    }

    socket.data.account = account;
    socket.data.sessionId = verified.sessionId;
    socket.data.accessToken = authToken;
  }

  socket.data.client = socket.handshake.auth?.client === "desktop" ? "desktop" : "web";

  next();
});

const persistence = createPersistenceRuntime(config);
const { sqliteDatabase, pool, initDatabase, closeDatabase: closePersistenceDatabase } = persistence;
const retention = createRetentionService({
  pool,
  memoryDmMessages,
  memoryDmReports,
  guildAuditEvents
});

async function closeDatabase() {
  retention.stop();
  await closePersistenceDatabase();
}

const accountService = createAccountService({ pool, memoryAccounts });
const {
  accountByEmail,
  accountById,
  createAccount,
  listAccounts,
  publicAccount,
  publicUserById,
  updateAvatar,
  usernameExists
} = accountService;
const friendService = createFriendService({
  pool,
  sqliteDatabase,
  memoryAccounts,
  memoryFriendships,
  memoryDmConversations,
  memoryDmMessages,
  memoryDmRequests,
  memoryDmPeerPreferences,
  memoryDmPrivacy,
  memoryDmReports,
  publicUserById
});
const {
  areFriends,
  acceptDmRequest,
  conversationFor,
  conversationMembers,
  createGroupConversation,
  dmById,
  findUsersByUsername,
  friendshipBetween,
  friendshipKey,
  listFriendState,
  listConversations,
  listDmPreferences,
  getDmPrivacy,
  updateDmPrivacy,
  updateDmPeerPreference,
  listDmRequests,
  loadConversationHistory,
  loadDmHistory,
  searchDm,
  leaveGroupConversation,
  mutateGroupMember,
  createDmRequest,
  dmRequestBetween,
  updateDmRequestStatus,
  storeDm,
  createDmReport,
  validateAttachment
} = friendService;
const guildService = createGuildService({
  io,
  pool,
  accountById,
  guilds,
  guildMembers,
  guildRoles,
  guildChannels,
  guildCategories,
  guildPermissionOverrides,
  guildInvites,
  users,
  guildModeration,
  guildAuditEvents
});
const guildChat = createGuildChatService(pool, memoryGuildMessages);
const guildNotifications = createGuildNotificationService({
  pool,
  memoryState: memoryGuildChannelUserState,
  memoryMessages: memoryGuildMessages
});
const {
  broadcastPresence,
  canManage,
  createGuild,
  createInvite,
  getPresence,
  guildList,
  isMember,
  joinByInvite,
  leaveCurrentRoom,
  leaveGuild,
  deleteGuild,
  loadGuilds,
  ensureMainGuildMembership,
  ensureMainGuildOwner,
  roleFor,
  roomFor,
  textRoomFor,
  sendLobbyState,
  setRole,
  revokeInvite,
  renameLobby,
  createChannel,
  guildChannels: listGuildChannels,
  guildCategories: listGuildCategories,
  createCategory,
  updateCategory,
  reorderCategories,
  reorderChannels,
  setPermissionOverride,
  listPermissionOverrides,
  membersFor,
  reportMember,
  reportsFor,
  updateChannel,
  hasPermission,
  moderateMember,
  auditFor
} = guildService;

guilds.set("echoverse", {
  id: "echoverse",
  name: "EchoVerse",
  createdBy: "system",
  createdAt: new Date().toISOString()
});

function verifyToken(token: string) {
  return sessionManager.verifyAccess(token)?.userId || "";
}

const authHttpRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false
});

registerIdentityHttpRoutes({
  app,
  authRateLimit: authHttpRateLimit,
  config,
  sessionManager,
  accountByEmail,
  accountById,
  createAccount,
  ensureMainGuildMembership,
  usernameExists,
  publicAccount,
  httpError
});

function onValidatedSocketEvent(
  socket: any,
  event: keyof typeof socketEventPayloadSchemas,
  handler: (payload: any, callback?: (response: unknown) => void) => unknown
) {
  const schema = socketEventPayloadSchemas[event];
  socket.on(event, (payload: unknown, callback?: (response: unknown) => void) => {
    const actualCallback =
      typeof payload === "function" ? (payload as (response: unknown) => void) : callback;
    const candidate = typeof payload === "function" ? undefined : payload;
    const parsed = schema.safeParse(candidate);
    if (!parsed.success) {
      serverMetrics.increment("socket.events.invalid_payload");
      actualCallback?.({ ok: false, error: socketError(socket, "server.invalidRequest") });
      return;
    }
    return handler(parsed.data, actualCallback);
  });
}

function emitToAccount(accountId: string, event: string, payload: any) {
  for (const peer of io.sockets.sockets.values()) {
    if ((peer.data as any).account?.id === accountId) {
      peer.emit(event, payload);
    }
  }
}

function emitDmPair(msg: StoredDm, event: string, payload: any) {
  emitToAccount(msg.senderId, event, payload);
  emitToAccount(msg.recipientId, event, payload);
}

function socketForAccount(accountId: string) {
  return [...users.values()].find((u) => u.accountId === accountId);
}

function attachAccountToSocket(socket: any, account: Account, sessionId?: string) {
  const current = users.get(socket.id);

  const user: User = {
    socketId: socket.id,
    userId: account.id,
    accountId: account.id,
    username: account.username,
    avatarData: account.avatarData,
    roomId: current?.roomId,
    guildId: current?.guildId,
    activeGuildId: current?.activeGuildId
  };

  users.set(socket.id, user);
  socket.data.account = account;
  if (sessionId) socket.data.sessionId = sessionId;

  return publicAccount(account);
}

io.on("connection", (socket) => {
  socket.data.correlationId = createCorrelationId(
    socket.handshake.headers["x-echoverse-request-id"]
  );
  serverMetrics.increment("socket.connections.accepted");
  serverLogger.info("echoverse.socket.connected", {
    correlationId: socket.data.correlationId,
    client: socket.data.client
  });
  socket.data.protocolVersion = PROTOCOL_VERSION;
  socket.emit("protocol:ready", { version: PROTOCOL_VERSION });
  if (socket.data.account) {
    attachAccountToSocket(socket, socket.data.account, socket.data.sessionId);
    void ensureMainGuildMembership(socket.data.account)
      .then(() => {
        socket.emit("guild:list", guildList(socket.data.account.id));
        socket.emit("auth:session", { ok: true, account: publicAccount(socket.data.account) });
      })
      .catch(() => {
        serverLogger.error("echoverse.guild.main_membership_reconcile_failed");
        socket.emit("guild:list", guildList());
        socket.emit("auth:session", { ok: true, account: publicAccount(socket.data.account) });
      });
  } else {
    socket.emit("guild:list", guildList());
  }

  const handlerRateLimitedEvents = new Set([
    "auth:register",
    "auth:login",
    "dm:send",
    "webrtc-offer",
    "webrtc-answer",
    "webrtc-ice"
  ]);

  socket.use(([event, payload], next) => {
    const eventName = String(event);
    if (!socketPayloadWithinLimit(payload)) {
      serverMetrics.increment("socket.events.rejected_oversize");
      next(new Error(socketError(socket, "server.payloadTooLarge")));
      return;
    }
    if (
      !handlerRateLimitedEvents.has(eventName) &&
      !allowSocketEvent(socket.id, eventName, socketEventLimit(eventName))
    ) {
      serverMetrics.increment("socket.events.rejected_rate_limit");
      next(new Error(socketError(socket, "server.tooManyRequests")));
      return;
    }
    if (!socket.data.sessionId) {
      next();
      return;
    }
    if (sessionManager.verifyAccess(String(socket.data.accessToken || ""))) {
      next();
      return;
    }
    socket.emit("auth:expired");
    socket.disconnect(true);
    next(new Error(socketError(socket, "server.sessionExpired")));
  });

  registerIdentityHandlers({
    socket,
    users,
    sessionManager,
    accountByEmail,
    accountById,
    createAccount,
    updateAvatar,
    usernameExists,
    publicAccount,
    guildList,
    ensureMainGuildMembership,
    attachAccountToSocket,
    verifyToken,
    leaveCurrentRoom,
    broadcastPresence,
    allowSocketEvent,
    socketError,
    onValidatedSocketEvent
  });

  registerChatHandlers({
    socket,
    io,
    users,
    guildChat,
    isMember,
    membersFor: guildService.membersFor,
    listChannels: listGuildChannels,
    hasScopedPermission: guildService.hasScopedPermission,
    socketError,
    accountById,
    resolveRequestLocale,
    notificationService: guildNotifications,
    onValidatedSocketEvent
  });

  registerGuildNotificationHandlers({
    socket,
    users,
    notificationService: guildNotifications,
    isMember,
    listChannels: listGuildChannels,
    hasScopedPermission: guildService.hasScopedPermission,
    emitToAccount,
    socketError,
    onValidatedSocketEvent
  });

  const { endCallsForSocket } = registerCallHandlers({
    socket,
    io,
    users,
    pendingCalls,
    activeCalls,
    activeGroupCalls,
    conversationFor,
    conversationMembers,
    socketForAccount,
    areFriends,
    allowSocketEvent,
    socketError,
    onValidatedSocketEvent
  });
  registerGuildHandlers({
    socket,
    io,
    users,
    guilds,
    areFriends,
    accountPresence,
    roomFor,
    textRoomFor,
    guildList,
    canManage,
    createGuild,
    createInvite,
    isMember,
    joinByInvite,
    leaveGuild,
    deleteGuild,
    roleFor,
    setRole,
    revokeInvite,
    renameLobby,
    createChannel,
    updateChannel,
    listChannels: listGuildChannels,
    guildCategories: listGuildCategories,
    createCategory,
    updateCategory,
    reorderCategories,
    reorderChannels,
    setPermissionOverride,
    listPermissionOverrides,
    membersFor,
    reportMember,
    reportsFor,
    hasPermission,
    hasScopedPermission: guildService.hasScopedPermission,
    moderateMember,
    auditFor,
    getPresence,
    sendLobbyState,
    leaveCurrentRoom,
    broadcastPresence,
    sanitizeName,
    socketError,
    onValidatedSocketEvent
  });
  registerFriendHandlers({
    socket,
    io,
    users,
    pool,
    memoryFriendships,
    memoryDmMessages,
    dmReadAt,
    accountById,
    findUsersByUsername,
    listFriendState,
    listConversations,
    listDmPreferences,
    getDmPrivacy,
    updateDmPrivacy,
    updateDmPeerPreference,
    loadConversationHistory,
    friendshipBetween,
    friendshipKey,
    areFriends,
    listDmRequests,
    createDmRequest,
    dmRequestBetween,
    updateDmRequestStatus,
    acceptDmRequest,
    loadDmHistory,
    searchDm,
    conversationFor,
    conversationMembers,
    createGroupConversation,
    leaveGroupConversation,
    mutateGroupMember,
    storeDm,
    createDmReport,
    dmById,
    validateAttachment,
    socketForAccount,
    emitToAccount,
    emitDmPair,
    resolveRequestLocale,
    sanitizeText,
    allowSocketEvent,
    socketError,
    onValidatedSocketEvent
  });

  socket.on("disconnect", () => {
    serverMetrics.increment("socket.connections.closed");
    serverLogger.info("echoverse.socket.disconnected", {
      correlationId: socket.data.correlationId
    });
    endCallsForSocket(socket.id);
    const user = users.get(socket.id);

    if (user?.roomId && user.guildId) {
      const oldRoom = user.roomId;

      socket.to(oldRoom).emit("peer-left", {
        socketId: socket.id,
        username: user.username
      });

      users.delete(socket.id);
      clearSocketLimits(socket.id);
      broadcastPresence(oldRoom);
    } else {
      users.delete(socket.id);
      clearSocketLimits(socket.id);
    }
  });
});

// Serve the same built renderer used by the browser and Electron cache. The
// API and Socket.IO routes are registered first; static files and the SPA
// fallback therefore cannot shadow protocol endpoints.
app.use(
  express.static(webDistPath, {
    index: "index.html",
    fallthrough: true,
    dotfiles: "deny"
  })
);
app.get("*", (req, res, next) => {
  if (req.method !== "GET" || !req.accepts("html") || extname(req.path)) {
    next();
    return;
  }
  if (!existsSync(webIndexPath)) {
    next();
    return;
  }
  res.sendFile(webIndexPath, (error) => {
    if (error) next(error);
  });
});

app.use(
  (error: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (res.headersSent) {
      next(error);
      return;
    }
    res.status(400).json({ ok: false, error: httpError(req, "server.requestFailed") });
  }
);

const PORT = config.port;

export { app, closeDatabase, httpServer, io, initDatabase };

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  initDatabase()
    .then(async () => {
      const cleanup = await retention.purgeExpiredData();
      if (
        cleanup.dmReports ||
        cleanup.guildReports ||
        cleanup.guildAuditEvents ||
        cleanup.dmMessages ||
        cleanup.guildMessages
      ) {
        serverLogger.info("echoverse.retention.cleaned", cleanup);
      }
      retention.start((error) => {
        serverLogger.error("echoverse.retention.cleanup_failed", {
          error: error instanceof Error ? error.message : "unknown"
        });
      });
      await loadGuilds();
      const accounts = await listAccounts();
      const configuredOwnerEmail =
        process.env.ECHO_VERSE_MAIN_OWNER_EMAIL?.trim().toLocaleLowerCase("en-US");
      const owner = configuredOwnerEmail ? await accountByEmail(configuredOwnerEmail) : null;
      if (owner) await ensureMainGuildOwner(owner);
      for (const account of accounts) await ensureMainGuildMembership(account);
    })
    .then(() => {
      httpServer.listen(PORT, config.host, () => {
        serverLogger.info("echoverse.server.listening", {
          version: APP_VERSION,
          host: config.host,
          port: PORT
        });
      });
    })
    .catch((error: unknown) => {
      const failure = error instanceof Error ? error.message : String(error);
      serverLogger.error("echoverse.database.init_failed", {
        startupFailure: failure
          .replace(/(?:postgres(?:ql)?:\/\/)[^\s]+/gi, "[REDACTED_URL]")
          .slice(0, 240)
      });
      process.exit(1);
    });
}
