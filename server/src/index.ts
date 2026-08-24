import express from "express";
import cors from "cors";
import http from "http";
import crypto from "crypto";
import { Server } from "socket.io";

const app = express();
app.use(cors({ origin: true, credentials: false }));
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    name: "EchoVerse Server",
    version: "1.1.0",
    ok: true,
    time: new Date().toISOString()
  });
});

app.get("/health", (_req, res) => res.json({ ok: true, version: "1.1.0" }));

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: { origin: true, methods: ["GET", "POST"] },
  transports: ["websocket", "polling"]
});

type User = {
  socketId: string;
  userId: string;
  username: string;
  roomId?: string;
  guildId?: string;
};

type Guild = {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
};

const users = new Map<string, User>();
const guilds = new Map<string, Guild>();

guilds.set("echoverse", {
  id: "echoverse",
  name: "EchoVerse",
  createdBy: "system",
  createdAt: new Date().toISOString()
});

function sanitizeName(value: unknown, max = 28) {
  const s = String(value ?? "").trim().slice(0, max);
  return s || "Guest";
}

function sanitizeText(value: unknown) {
  return String(value ?? "").trim().slice(0, 2500);
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
      username: u.username
    }));
}

function broadcastPresence(roomId: string) {
  io.to(roomId).emit("presence", getPresence(roomId));
}

function leaveCurrentRoom(socket: any, user: User) {
  if (!user.roomId) return;

  const oldRoom = user.roomId;
  socket.leave(oldRoom);
  socket.to(oldRoom).emit("peer-left", { socketId: socket.id });

  user.roomId = undefined;
  user.guildId = undefined;
  users.set(socket.id, user);

  broadcastPresence(oldRoom);
}

io.on("connection", socket => {
  socket.emit("guild:list", guildList());

  socket.on("identify", ({ userId, username }) => {
    users.set(socket.id, {
      socketId: socket.id,
      userId: String(userId || crypto.randomUUID()),
      username: sanitizeName(username)
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

    const safeGuild = guilds.has(String(guildId)) ? String(guildId) : "echoverse";
    leaveCurrentRoom(socket, user);

    const roomId = roomFor(safeGuild);
    user.roomId = roomId;
    user.guildId = safeGuild;
    users.set(socket.id, user);

    socket.join(roomId);

    const peers = getPresence(roomId).filter(p => p.socketId !== socket.id);
    socket.emit("room-peers", peers);

    socket.to(roomId).emit("peer-joined", {
      socketId: socket.id,
      userId: user.userId,
      username: user.username
    });

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
        text: botText,
        bot: true,
        createdAt: new Date().toISOString()
      });
    };

    if (cmd === "!ping") bot("Pong 🏓");
    if (cmd === "!roll") bot(`🎲 ${Math.floor(Math.random() * 100) + 1}`);
    if (cmd === "!help") bot("Komutlar: !ping, !roll, !help");
  });

  socket.on("webrtc-offer", ({ to, sdp }) => {
    io.to(String(to)).emit("webrtc-offer", { from: socket.id, sdp });
  });

  socket.on("webrtc-answer", ({ to, sdp }) => {
    io.to(String(to)).emit("webrtc-answer", { from: socket.id, sdp });
  });

  socket.on("webrtc-ice", ({ to, candidate }) => {
    io.to(String(to)).emit("webrtc-ice", { from: socket.id, candidate });
  });

  socket.on("disconnect", () => {
    const user = users.get(socket.id);
    if (user?.roomId) {
      const oldRoom = user.roomId;
      socket.to(oldRoom).emit("peer-left", { socketId: socket.id });
      users.delete(socket.id);
      broadcastPresence(oldRoom);
    } else {
      users.delete(socket.id);
    }
  });
});

const PORT = Number(process.env.PORT || 3001);

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`EchoVerse Server v1.1 listening on ${PORT}`);
});
