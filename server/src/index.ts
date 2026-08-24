import express from "express";
import cors from "cors";
import http from "http";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pg from "pg";
import { Server } from "socket.io";

const { Pool } = pg;

const app = express();
app.use(cors({ origin: true, credentials: false }));
app.use(express.json({ limit: "2mb" }));

app.get("/", (_req, res) => {
  res.json({
    name: "EchoVerse Server",
    version: "1.4.0",
    ok: true,
    database: process.env.DATABASE_URL ? "postgres" : "memory",
    time: new Date().toISOString()
  });
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    version: "1.4.0",
    database: process.env.DATABASE_URL ? "postgres" : "memory"
  });
});

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: { origin: true, methods: ["GET", "POST"] },
  transports: ["websocket", "polling"],
  maxHttpBufferSize: 2e6
});

const JWT_SECRET =
  process.env.JWT_SECRET ||
  "echoverse-dev-secret-change-this-in-render";

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl:
        process.env.NODE_ENV === "production"
          ? { rejectUnauthorized: false }
          : undefined
    })
  : null;

type Account = {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  avatarData: string | null;
  createdAt: string;
};

type PublicAccount = {
  id: string;
  email: string;
  username: string;
  avatarData: string | null;
};

type User = {
  socketId: string;
  userId: string;
  username: string;
  avatarData: string | null;
  accountId?: string;
  roomId?: string;
  guildId?: string;
};

type Guild = {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
};

type SpotifyPartyState = {
  guildId: string;
  leaderSocketId: string;
  leaderUsername: string;
  active: boolean;
  trackUri?: string;
  trackName?: string;
  artistName?: string;
  albumImage?: string;
  positionMs?: number;
  isPlaying?: boolean;
  updatedAt?: number;
};

const users = new Map<string, User>();
const guilds = new Map<string, Guild>();
const spotifyParties = new Map<string, SpotifyPartyState>();

// Fallback only. Use Render PostgreSQL for persistence.
const memoryAccounts = new Map<string, Account>();

guilds.set("echoverse", {
  id: "echoverse",
  name: "EchoVerse",
  createdBy: "system",
  createdAt: new Date().toISOString()
});

function sanitizeName(value: unknown, max = 28) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, max);
}

function sanitizeEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase().slice(0, 160);
}

function sanitizeText(value: unknown) {
  return String(value ?? "").trim().slice(0, 2500);
}

function validEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function publicAccount(account: Account): PublicAccount {
  return {
    id: account.id,
    email: account.email,
    username: account.username,
    avatarData: account.avatarData
  };
}

function signToken(account: Account) {
  return jwt.sign(
    {
      sub: account.id,
      username: account.username,
      email: account.email
    },
    JWT_SECRET,
    { expiresIn: "30d" }
  );
}

function verifyToken(token: string) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    return String(decoded.sub || "");
  } catch {
    return "";
  }
}

async function initDatabase() {
  if (!pool) {
    console.log("EchoVerse accounts: in-memory fallback");
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS echoverse_users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      avatar_data TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  console.log("EchoVerse accounts: PostgreSQL ready");
}

async function accountById(id: string): Promise<Account | null> {
  if (!id) return null;

  if (!pool) {
    return memoryAccounts.get(id) || null;
  }

  const result = await pool.query(
    `SELECT id, email, username, password_hash, avatar_data, created_at
     FROM echoverse_users
     WHERE id = $1
     LIMIT 1`,
    [id]
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    id: row.id,
    email: row.email,
    username: row.username,
    passwordHash: row.password_hash,
    avatarData: row.avatar_data || null,
    createdAt: row.created_at?.toISOString?.() || String(row.created_at)
  };
}

async function accountByEmail(email: string): Promise<Account | null> {
  if (!pool) {
    for (const account of memoryAccounts.values()) {
      if (account.email === email) return account;
    }
    return null;
  }

  const result = await pool.query(
    `SELECT id, email, username, password_hash, avatar_data, created_at
     FROM echoverse_users
     WHERE email = $1
     LIMIT 1`,
    [email]
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    id: row.id,
    email: row.email,
    username: row.username,
    passwordHash: row.password_hash,
    avatarData: row.avatar_data || null,
    createdAt: row.created_at?.toISOString?.() || String(row.created_at)
  };
}

async function usernameExists(username: string) {
  if (!pool) {
    return [...memoryAccounts.values()].some(
      a => a.username.toLowerCase() === username.toLowerCase()
    );
  }

  const result = await pool.query(
    `SELECT 1 FROM echoverse_users WHERE LOWER(username) = LOWER($1) LIMIT 1`,
    [username]
  );

  return result.rowCount > 0;
}

async function createAccount(
  email: string,
  username: string,
  passwordHash: string
): Promise<Account> {
  const account: Account = {
    id: crypto.randomUUID(),
    email,
    username,
    passwordHash,
    avatarData: null,
    createdAt: new Date().toISOString()
  };

  if (!pool) {
    memoryAccounts.set(account.id, account);
    return account;
  }

  await pool.query(
    `INSERT INTO echoverse_users
       (id, email, username, password_hash, avatar_data)
     VALUES ($1, $2, $3, $4, NULL)`,
    [account.id, account.email, account.username, account.passwordHash]
  );

  return account;
}

async function updateAvatar(accountId: string, avatarData: string | null) {
  if (!pool) {
    const account = memoryAccounts.get(accountId);
    if (!account) return null;
    account.avatarData = avatarData;
    memoryAccounts.set(accountId, account);
    return account;
  }

  await pool.query(
    `UPDATE echoverse_users SET avatar_data = $1 WHERE id = $2`,
    [avatarData, accountId]
  );

  return accountById(accountId);
}

function guildList() {
  return [...guilds.values()];
}

function roomFor(guildId: string) {
  return `guild:${guildId}:lobby`;
}

function getPresence(roomId: string) {
  return [...users.values()]
    .filter(u => u.roomId === roomId)
    .map(u => ({
      socketId: u.socketId,
      userId: u.userId,
      username: u.username,
      avatarData: u.avatarData
    }));
}

function broadcastPresence(roomId: string) {
  io.to(roomId).emit("presence", getPresence(roomId));
}

function leaveCurrentRoom(socket: any, user: User) {
  if (!user.roomId) return;

  const oldRoom = user.roomId;
  const oldGuild = user.guildId;

  socket.leave(oldRoom);
  socket.to(oldRoom).emit("peer-left", { socketId: socket.id });

  if (oldGuild) {
    const party = spotifyParties.get(oldGuild);
    if (party?.leaderSocketId === socket.id) {
      spotifyParties.delete(oldGuild);
      io.to(oldRoom).emit("spotify:party-ended");
    }
  }

  user.roomId = undefined;
  user.guildId = undefined;
  users.set(socket.id, user);

  broadcastPresence(oldRoom);
}

async function attachAccountToSocket(socket: any, account: Account) {
  const current = users.get(socket.id);

  const user: User = {
    socketId: socket.id,
    userId: account.id,
    accountId: account.id,
    username: account.username,
    avatarData: account.avatarData,
    roomId: current?.roomId,
    guildId: current?.guildId
  };

  users.set(socket.id, user);

  return {
    token: signToken(account),
    account: publicAccount(account)
  };
}

io.on("connection", socket => {
  socket.emit("guild:list", guildList());

  socket.on("auth:register", async (payload, callback) => {
    try {
      const email = sanitizeEmail(payload?.email);
      const username = sanitizeName(payload?.username);
      const password = String(payload?.password || "");

      if (!validEmail(email)) {
        callback?.({ ok: false, error: "Geçerli bir e-posta yaz." });
        return;
      }

      if (username.length < 3) {
        callback?.({ ok: false, error: "Kullanıcı adı en az 3 karakter olmalı." });
        return;
      }

      if (password.length < 6) {
        callback?.({ ok: false, error: "Şifre en az 6 karakter olmalı." });
        return;
      }

      if (await accountByEmail(email)) {
        callback?.({ ok: false, error: "Bu e-posta zaten kayıtlı." });
        return;
      }

      if (await usernameExists(username)) {
        callback?.({ ok: false, error: "Bu kullanıcı adı alınmış." });
        return;
      }

      const hash = await bcrypt.hash(password, 12);
      const account = await createAccount(email, username, hash);
      const session = await attachAccountToSocket(socket, account);

      callback?.({ ok: true, ...session });
    } catch (err: any) {
      console.error("register error", err);
      callback?.({ ok: false, error: "Hesap oluşturulamadı." });
    }
  });

  socket.on("auth:login", async (payload, callback) => {
    try {
      const email = sanitizeEmail(payload?.email);
      const password = String(payload?.password || "");

      const account = await accountByEmail(email);

      if (!account || !(await bcrypt.compare(password, account.passwordHash))) {
        callback?.({ ok: false, error: "E-posta veya şifre yanlış." });
        return;
      }

      const session = await attachAccountToSocket(socket, account);
      callback?.({ ok: true, ...session });
    } catch (err) {
      console.error("login error", err);
      callback?.({ ok: false, error: "Giriş yapılamadı." });
    }
  });

  socket.on("auth:resume", async ({ token }, callback) => {
    try {
      const accountId = verifyToken(String(token || ""));
      const account = await accountById(accountId);

      if (!account) {
        callback?.({ ok: false });
        return;
      }

      const session = await attachAccountToSocket(socket, account);
      callback?.({ ok: true, ...session });
    } catch {
      callback?.({ ok: false });
    }
  });

  socket.on("auth:logout", () => {
    const current = users.get(socket.id);
    if (current?.roomId) leaveCurrentRoom(socket, current);
    users.delete(socket.id);
  });

  socket.on("profile:set-avatar", async ({ token, avatarData }, callback) => {
    try {
      const accountId = verifyToken(String(token || ""));
      if (!accountId) {
        callback?.({ ok: false, error: "Oturum geçersiz." });
        return;
      }

      let clean: string | null = null;

      if (avatarData) {
        clean = String(avatarData);

        if (!/^data:image\/(png|jpeg|webp);base64,/i.test(clean)) {
          callback?.({ ok: false, error: "Geçersiz profil fotoğrafı." });
          return;
        }

        if (clean.length > 700_000) {
          callback?.({ ok: false, error: "Profil fotoğrafı çok büyük." });
          return;
        }
      }

      const account = await updateAvatar(accountId, clean);

      if (!account) {
        callback?.({ ok: false, error: "Hesap bulunamadı." });
        return;
      }

      const user = users.get(socket.id);
      if (user) {
        user.avatarData = account.avatarData;
        users.set(socket.id, user);
        if (user.roomId) broadcastPresence(user.roomId);
      }

      callback?.({
        ok: true,
        account: publicAccount(account)
      });
    } catch (err) {
      console.error("avatar error", err);
      callback?.({ ok: false, error: "Profil fotoğrafı güncellenemedi." });
    }
  });

  // Backward compatibility for old clients during rollout.
  socket.on("identify", async ({ token, userId, username }) => {
    const accountId = verifyToken(String(token || ""));

    if (accountId) {
      const account = await accountById(accountId);
      if (account) {
        await attachAccountToSocket(socket, account);
        socket.emit("guild:list", guildList());
        return;
      }
    }

    users.set(socket.id, {
      socketId: socket.id,
      userId: String(userId || crypto.randomUUID()),
      username: sanitizeName(username) || "Guest",
      avatarData: null
    });

    socket.emit("guild:list", guildList());
  });

  socket.on("guild:create", ({ name }, callback) => {
    const user = users.get(socket.id);
    if (!user) {
      callback?.({ ok: false, error: "Önce giriş yap." });
      return;
    }

    const guildName = sanitizeName(name, 32);

    if (!guildName) {
      callback?.({ ok: false, error: "Sunucu adı boş olamaz." });
      return;
    }

    const id = crypto.randomBytes(4).toString("hex");

    const guild: Guild = {
      id,
      name: guildName,
      createdBy: user.userId,
      createdAt: new Date().toISOString()
    };

    guilds.set(id, guild);
    io.emit("guild:list", guildList());

    callback?.({ ok: true, guild });
  });

  socket.on("guild:join-code", ({ code }, callback) => {
    const id = String(code ?? "").trim().toLowerCase();

    if (!guilds.has(id)) {
      callback?.({ ok: false, error: "Sunucu kodu bulunamadı." });
      return;
    }

    callback?.({ ok: true, guild: guilds.get(id) });
  });

  socket.on("join-room", ({ guildId }) => {
    const user = users.get(socket.id);
    if (!user) return;

    const safeGuild = guilds.has(String(guildId))
      ? String(guildId)
      : "echoverse";

    leaveCurrentRoom(socket, user);

    const roomId = roomFor(safeGuild);
    user.roomId = roomId;
    user.guildId = safeGuild;
    users.set(socket.id, user);

    socket.join(roomId);

    const peers = getPresence(roomId).filter(
      p => p.socketId !== socket.id
    );

    socket.emit("room-peers", peers);

    socket.to(roomId).emit("peer-joined", {
      socketId: socket.id,
      userId: user.userId,
      username: user.username,
      avatarData: user.avatarData
    });

    const party = spotifyParties.get(safeGuild);
    if (party?.active) socket.emit("spotify:party-state", party);

    broadcastPresence(roomId);
  });

  socket.on("leave-room", () => {
    const user = users.get(socket.id);
    if (!user) return;
    leaveCurrentRoom(socket, user);
    socket.emit("presence", []);
  });

  socket.on("chat-message", ({ guildId, text }) => {
    const user = users.get(socket.id);
    if (!user || !user.roomId || user.guildId !== guildId) return;

    const safeText = sanitizeText(text);
    if (!safeText) return;

    const msg = {
      id: crypto.randomUUID(),
      guildId,
      userId: user.userId,
      username: user.username,
      avatarData: user.avatarData,
      text: safeText,
      createdAt: new Date().toISOString()
    };

    io.to(user.roomId).emit("chat-message", msg);

    const cmd = safeText.toLowerCase();

    const bot = (botText: string) => {
      io.to(user.roomId!).emit("chat-message", {
        id: crypto.randomUUID(),
        guildId,
        userId: "bot:utility",
        username: "EchoBot",
        avatarData: null,
        text: botText,
        bot: true,
        createdAt: new Date().toISOString()
      });
    };

    if (cmd === "!ping") bot("Pong 🏓");
    if (cmd === "!roll") bot(`🎲 ${Math.floor(Math.random() * 100) + 1}`);
    if (cmd === "!help") bot("Komutlar: !ping, !roll, !help");
  });

  socket.on("spotify:party-start", ({ guildId }) => {
    const user = users.get(socket.id);
    if (!user || user.guildId !== guildId || !user.roomId) return;

    const state: SpotifyPartyState = {
      guildId,
      leaderSocketId: socket.id,
      leaderUsername: user.username,
      active: true,
      updatedAt: Date.now()
    };

    spotifyParties.set(guildId, state);
    io.to(user.roomId).emit("spotify:party-state", state);
  });

  socket.on("spotify:party-stop", ({ guildId }) => {
    const user = users.get(socket.id);
    const party = spotifyParties.get(guildId);

    if (!user || !party || party.leaderSocketId !== socket.id) return;

    spotifyParties.delete(guildId);
    io.to(roomFor(guildId)).emit("spotify:party-ended");
  });

  socket.on("spotify:sync", ({ guildId, state }) => {
    const user = users.get(socket.id);
    const party = spotifyParties.get(guildId);

    if (!user || !party || party.leaderSocketId !== socket.id) return;

    const next: SpotifyPartyState = {
      ...party,
      ...state,
      guildId,
      leaderSocketId: socket.id,
      leaderUsername: user.username,
      active: true,
      updatedAt: Date.now()
    };

    spotifyParties.set(guildId, next);
    socket.to(roomFor(guildId)).emit("spotify:sync", next);
  });

  socket.on("webrtc-offer", ({ to, sdp }) => {
    io.to(String(to)).emit("webrtc-offer", {
      from: socket.id,
      sdp
    });
  });

  socket.on("webrtc-answer", ({ to, sdp }) => {
    io.to(String(to)).emit("webrtc-answer", {
      from: socket.id,
      sdp
    });
  });

  socket.on("webrtc-ice", ({ to, candidate }) => {
    io.to(String(to)).emit("webrtc-ice", {
      from: socket.id,
      candidate
    });
  });

  socket.on("disconnect", () => {
    const user = users.get(socket.id);

    if (user?.roomId && user.guildId) {
      const oldRoom = user.roomId;
      const party = spotifyParties.get(user.guildId);

      if (party?.leaderSocketId === socket.id) {
        spotifyParties.delete(user.guildId);
        io.to(oldRoom).emit("spotify:party-ended");
      }

      socket.to(oldRoom).emit("peer-left", {
        socketId: socket.id
      });

      users.delete(socket.id);
      broadcastPresence(oldRoom);
    } else {
      users.delete(socket.id);
    }
  });
});

const PORT = Number(process.env.PORT || 3001);

initDatabase()
  .then(() => {
    httpServer.listen(PORT, "0.0.0.0", () => {
      console.log(`EchoVerse Server v1.4 listening on ${PORT}`);
    });
  })
  .catch(err => {
    console.error("Database init failed", err);
    process.exit(1);
  });
