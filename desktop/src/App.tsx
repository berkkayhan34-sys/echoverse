import { useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

type PeerInfo = {
  socketId: string;
  userId: string;
  username: string;
};

type ChatMessage = {
  id: string;
  username: string;
  text: string;
  createdAt: string;
  bot?: boolean;
};

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" }
];

export default function App() {
  const [serverUrl, setServerUrl] = useState("");
  const [socket, setSocket] = useState<Socket | null>(null);
  const [username, setUsername] = useState(
    () => localStorage.getItem("echoverse_username") || ""
  );
  const [connected, setConnected] = useState(false);
  const [joined, setJoined] = useState(false);
  const [roomId] = useState("lobby");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [presence, setPresence] = useState<PeerInfo[]>([]);
  const [text, setText] = useState("");
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [screenOn, setScreenOn] = useState(false);
  const [error, setError] = useState("");

  const localStream = useRef<MediaStream | null>(null);
  const pcs = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteAudio = useRef<Map<string, HTMLAudioElement>>(new Map());
  const remoteVideoHost = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    (async () => {
      const cfg = window.echoverse
        ? await window.echoverse.getConfig()
        : { serverUrl: "http://localhost:3001" };
      setServerUrl(cfg.serverUrl);
    })();
  }, []);

  useEffect(() => {
    if (!serverUrl) return;

    const s = io(serverUrl, {
      transports: ["websocket", "polling"],
      reconnection: true
    });

    setSocket(s);

    s.on("connect", () => {
      setConnected(true);
      setError("");
    });

    s.on("disconnect", () => setConnected(false));

    s.on("connect_error", err => {
      setConnected(false);
      setError(`Sunucuya bağlanılamadı: ${err.message}`);
    });

    s.on("chat-message", (msg: ChatMessage) => {
      setMessages(prev => [...prev, msg]);
    });

    s.on("presence", (list: PeerInfo[]) => {
      setPresence(list);
    });

    s.on("room-peers", async (peers: PeerInfo[]) => {
      for (const peer of peers) {
        await createPeer(s, peer.socketId, true);
      }
    });

    s.on("peer-joined", async (peer: PeerInfo) => {
      await createPeer(s, peer.socketId, false);
    });

    s.on("peer-left", ({ socketId }: { socketId: string }) => {
      removePeer(socketId);
    });

    s.on("webrtc-offer", async ({ from, sdp }) => {
      const pc = await createPeer(s, from, false);
      await pc.setRemoteDescription(sdp);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      s.emit("webrtc-answer", { to: from, sdp: answer });
    });

    s.on("webrtc-answer", async ({ from, sdp }) => {
      const pc = pcs.current.get(from);
      if (pc && !pc.currentRemoteDescription) {
        await pc.setRemoteDescription(sdp);
      }
    });

    s.on("webrtc-ice", async ({ from, candidate }) => {
      const pc = pcs.current.get(from);
      if (!pc) return;
      try {
        await pc.addIceCandidate(candidate);
      } catch {}
    });

    return () => {
      s.disconnect();
      pcs.current.forEach(pc => pc.close());
      pcs.current.clear();
    };
  }, [serverUrl]);

  async function ensureMicrophone() {
    if (localStream.current) return localStream.current;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1
      },
      video: false
    });

    localStream.current = stream;
    return stream;
  }

  async function createPeer(s: Socket, peerId: string, initiator: boolean) {
    const existing = pcs.current.get(peerId);
    if (existing) return existing;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcs.current.set(peerId, pc);

    const stream = await ensureMicrophone();

    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    });

    pc.onicecandidate = evt => {
      if (evt.candidate) {
        s.emit("webrtc-ice", {
          to: peerId,
          candidate: evt.candidate
        });
      }
    };

    pc.ontrack = evt => {
      const stream = evt.streams[0];
      if (!stream) return;

      if (evt.track.kind === "audio") {
        let audio = remoteAudio.current.get(peerId);

        if (!audio) {
          audio = new Audio();
          audio.autoplay = true;
          remoteAudio.current.set(peerId, audio);
        }

        audio.srcObject = stream;
        audio.play().catch(() => {});
      }

      if (evt.track.kind === "video") {
        attachRemoteVideo(peerId, stream);
      }
    };

    pc.onconnectionstatechange = () => {
      if (["failed", "closed"].includes(pc.connectionState)) {
        removePeer(peerId);
      }
    };

    if (initiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      s.emit("webrtc-offer", {
        to: peerId,
        sdp: offer
      });
    }

    return pc;
  }

  function removePeer(peerId: string) {
    pcs.current.get(peerId)?.close();
    pcs.current.delete(peerId);

    const audio = remoteAudio.current.get(peerId);
    if (audio) {
      audio.pause();
      audio.srcObject = null;
      remoteAudio.current.delete(peerId);
    }

    remoteVideoHost.current
      ?.querySelector(`[data-peer="${peerId}"]`)
      ?.remove();
  }

  function attachRemoteVideo(peerId: string, stream: MediaStream) {
    const host = remoteVideoHost.current;
    if (!host) return;

    let video = host.querySelector<HTMLVideoElement>(
      `video[data-peer="${peerId}"]`
    );

    if (!video) {
      video = document.createElement("video");
      video.dataset.peer = peerId;
      video.autoplay = true;
      video.playsInline = true;
      video.className = "remote-video";
      host.appendChild(video);
    }

    video.srcObject = stream;
  }

  async function enterApp() {
    if (!socket || !connected) {
      setError("Sunucu bağlantısı hazır değil.");
      return;
    }

    const clean = username.trim().slice(0, 28);
    if (!clean) {
      setError("Bir kullanıcı adı yaz.");
      return;
    }

    try {
      await ensureMicrophone();

      localStorage.setItem("echoverse_username", clean);

      socket.emit("identify", {
        userId: crypto.randomUUID(),
        username: clean
      });

      socket.emit("join-room", { roomId });

      setJoined(true);
      setError("");
    } catch (err: any) {
      setError(
        `Mikrofon açılamadı: ${err?.message || "izin verilmedi"}`
      );
    }
  }

  function sendMessage() {
    if (!socket || !joined) return;

    const value = text.trim();
    if (!value) return;

    socket.emit("chat-message", {
      roomId,
      text: value
    });

    setText("");
  }

  function toggleMute() {
    const stream = localStream.current;
    if (!stream) return;

    const next = !muted;

    stream.getAudioTracks().forEach(track => {
      track.enabled = !next;
    });

    setMuted(next);
  }

  async function toggleCamera() {
    const baseStream = await ensureMicrophone();

    if (!cameraOn) {
      try {
        const cam = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 }
          },
          audio: false
        });

        const track = cam.getVideoTracks()[0];
        baseStream.addTrack(track);

        pcs.current.forEach(pc => {
          pc.addTrack(track, baseStream);
        });

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = baseStream;
        }

        setCameraOn(true);
      } catch (err: any) {
        setError(`Kamera açılamadı: ${err?.message || "izin verilmedi"}`);
      }
    } else {
      const track = baseStream.getVideoTracks()[0];

      if (track) {
        pcs.current.forEach(pc => {
          const sender = pc
            .getSenders()
            .find(s => s.track?.id === track.id);

          if (sender) pc.removeTrack(sender);
        });

        track.stop();
        baseStream.removeTrack(track);
      }

      setCameraOn(false);
    }
  }

  async function toggleScreen() {
    if (screenOn) {
      setScreenOn(false);
      return;
    }

    try {
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });

      const screenTrack = display.getVideoTracks()[0];

      pcs.current.forEach(pc => {
        const sender = pc
          .getSenders()
          .find(s => s.track?.kind === "video");

        if (sender) {
          sender.replaceTrack(screenTrack);
        } else {
          pc.addTrack(screenTrack, display);
        }
      });

      screenTrack.onended = () => {
        setScreenOn(false);
      };

      setScreenOn(true);
    } catch (err: any) {
      setError(`Ekran paylaşımı açılamadı: ${err?.message || "iptal edildi"}`);
    }
  }

  if (!joined) {
    return (
      <div className="welcome-page">
        <div className="welcome-card">
          <div className="logo-orb">E</div>
          <h1>EchoVerse</h1>
          <p>Arkadaşlarınla konuş, yazış, izle.</p>

          <div className={`server-state ${connected ? "online" : "offline"}`}>
            <span className="dot" />
            {connected ? "EchoVerse sunucusu online" : "Sunucuya bağlanıyor..."}
          </div>

          <label>Kullanıcı adı</label>
          <input
            value={username}
            maxLength={28}
            onChange={e => setUsername(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") enterApp();
            }}
            placeholder="Kullanıcı adın"
          />

          <button
            className="primary"
            onClick={enterApp}
            disabled={!connected}
          >
            EchoVerse'e Gir
          </button>

          {error && <div className="error-box">{error}</div>}

          <small className="server-url">{serverUrl}</small>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <aside className="servers">
        <div className="server-logo">E</div>
        <button className="server-circle active">EV</button>
        <button className="server-circle add">+</button>
      </aside>

      <aside className="channels">
        <div className="guild-title">
          EchoVerse
          <span>⌄</span>
        </div>

        <div className="channel-group">
          <div className="channel-title">TEXT CHANNELS</div>
          <button className="channel active"># general</button>
          <button className="channel"># music</button>
        </div>

        <div className="channel-group">
          <div className="channel-title">VOICE CHANNELS</div>

          <button className="channel voice active">
            🔊 Lobby
          </button>

          <div className="voice-users">
            {presence.map(p => (
              <div className="voice-user" key={p.socketId}>
                <span className="mini-dot" />
                {p.username}
              </div>
            ))}
          </div>
        </div>

        <div className="user-panel">
          <div className="user-avatar">
            {username.slice(0, 2).toUpperCase()}
          </div>

          <div className="user-info">
            <b>{username}</b>
            <small>Connected</small>
          </div>

          <button onClick={toggleMute}>
            {muted ? "🔇" : "🎙️"}
          </button>
        </div>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <b># general</b>
            <span>EchoVerse Lobby</span>
          </div>

          <div className="top-state">
            ✨ Noise suppression
          </div>
        </header>

        <div className="video-zone">
          <video
            ref={localVideoRef}
            muted
            autoPlay
            playsInline
            className={cameraOn ? "local-video" : "hidden"}
          />

          <div
            ref={remoteVideoHost}
            className="remote-video-host"
          />
        </div>

        <section className="message-list">
          <div className="channel-intro">
            <div className="big-hash">#</div>
            <h2># general'a hoş geldin</h2>
            <p>EchoVerse sohbetinin başlangıcı.</p>
          </div>

          {messages.map(m => (
            <div className="message" key={m.id}>
              <div className={`avatar ${m.bot ? "bot" : ""}`}>
                {m.bot
                  ? "EB"
                  : m.username.slice(0, 2).toUpperCase()}
              </div>

              <div className="message-body">
                <div className="message-meta">
                  <b>{m.username}</b>
                  <small>
                    {new Date(m.createdAt).toLocaleTimeString()}
                  </small>
                </div>

                <div className="message-text">{m.text}</div>
              </div>
            </div>
          ))}
        </section>

        <div className="composer">
          <button className="plus">+</button>

          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") sendMessage();
            }}
            placeholder="#general kanalına mesaj gönder"
          />

          <button onClick={() => setText(v => v + " 😂")}>
            😂
          </button>

          <button
            className="send"
            onClick={sendMessage}
          >
            Gönder
          </button>
        </div>

        <div className="call-controls">
          <button
            className={muted ? "danger" : ""}
            onClick={toggleMute}
          >
            {muted ? "🔇 Mikrofon kapalı" : "🎙️ Mikrofon"}
          </button>

          <button
            className={cameraOn ? "active-control" : ""}
            onClick={toggleCamera}
          >
            📹 {cameraOn ? "Kamerayı kapat" : "Kamera"}
          </button>

          <button
            className={screenOn ? "active-control" : ""}
            onClick={toggleScreen}
          >
            🖥️ {screenOn ? "Paylaşılıyor" : "Ekran paylaş"}
          </button>

          <span className="connection">
            ● {connected ? "Online" : "Offline"}
          </span>
        </div>

        {error && (
          <div
            className="floating-error"
            onClick={() => setError("")}
          >
            {error}
          </div>
        )}
      </main>

      <aside className="members">
        <div className="members-title">
          ONLINE — {presence.length}
        </div>

        {presence.map(p => (
          <div className="member" key={p.socketId}>
            <div className="avatar">
              {p.username.slice(0, 2).toUpperCase()}
            </div>

            <span>{p.username}</span>
          </div>
        ))}

        <div className="members-title bots">
          BOTS — 1
        </div>

        <div className="member">
          <div className="avatar bot">EB</div>

          <div>
            <span>EchoBot</span>
            <small className="bot-help">
              !help
            </small>
          </div>
        </div>
      </aside>
    </div>
  );
}
