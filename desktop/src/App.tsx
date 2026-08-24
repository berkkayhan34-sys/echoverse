import { useEffect, useRef, useState } from "react";
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

type Guild = {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
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
  const [identified, setIdentified] = useState(false);
  const [joined, setJoined] = useState(false);
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [activeGuild, setActiveGuild] = useState<Guild | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [presence, setPresence] = useState<PeerInfo[]>([]);
  const [text, setText] = useState("");
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [screenOn, setScreenOn] = useState(false);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [newGuildName, setNewGuildName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [updateStatus, setUpdateStatus] = useState("");

  const localStream = useRef<MediaStream | null>(null);
  const cameraTrack = useRef<MediaStreamTrack | null>(null);
  const outgoingVideoTrack = useRef<MediaStreamTrack | null>(null);
  const pcs = useRef<Map<string, RTCPeerConnection>>(new Map());
  const videoSenders = useRef<Map<string, RTCRtpSender>>(new Map());
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

    window.echoverse?.onUpdateStatus?.((status: string) => {
      setUpdateStatus(status);
    });
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

    s.on("guild:list", (list: Guild[]) => setGuilds(list));

    s.on("chat-message", (msg: ChatMessage) => {
      setMessages(prev => [...prev, msg]);
    });

    s.on("presence", (list: PeerInfo[]) => setPresence(list));

    s.on("room-peers", async (peers: PeerInfo[]) => {
      for (const peer of peers) await createPeer(s, peer.socketId, true);
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
      if (pc && pc.signalingState === "have-local-offer") {
        await pc.setRemoteDescription(sdp);
      }
    });

    s.on("webrtc-ice", async ({ from, candidate }) => {
      const pc = pcs.current.get(from);
      if (!pc) return;
      try { await pc.addIceCandidate(candidate); } catch {}
    });

    return () => {
      s.disconnect();
      stopAllMedia();
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
    stream.getAudioTracks().forEach(track => pc.addTrack(track, stream));

    const videoTransceiver = pc.addTransceiver("video", {
      direction: "sendrecv"
    });
    videoSenders.current.set(peerId, videoTransceiver.sender);

    if (outgoingVideoTrack.current) {
      await videoTransceiver.sender.replaceTrack(outgoingVideoTrack.current);
    }

    pc.onicecandidate = evt => {
      if (evt.candidate) {
        s.emit("webrtc-ice", { to: peerId, candidate: evt.candidate });
      }
    };

    pc.ontrack = evt => {
      const streamForTrack =
        evt.streams[0] || new MediaStream([evt.track]);

      if (evt.track.kind === "audio") {
        let audio = remoteAudio.current.get(peerId);
        if (!audio) {
          audio = new Audio();
          audio.autoplay = true;
          remoteAudio.current.set(peerId, audio);
        }
        audio.srcObject = streamForTrack;
        audio.play().catch(() => {});
      }

      if (evt.track.kind === "video") {
        attachRemoteVideo(peerId, streamForTrack);
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
      s.emit("webrtc-offer", { to: peerId, sdp: offer });
    }

    return pc;
  }

  function removePeer(peerId: string) {
    pcs.current.get(peerId)?.close();
    pcs.current.delete(peerId);
    videoSenders.current.delete(peerId);

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

  async function identify() {
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
        userId: localStorage.getItem("echoverse_user_id") || crypto.randomUUID(),
        username: clean
      });

      if (!localStorage.getItem("echoverse_user_id")) {
        localStorage.setItem("echoverse_user_id", crypto.randomUUID());
      }

      setIdentified(true);
      setError("");
    } catch (err: any) {
      setError(`Mikrofon açılamadı: ${err?.message || "izin verilmedi"}`);
    }
  }

  async function joinGuild(guild: Guild) {
    if (!socket) return;

    await leaveVoice(false);
    setActiveGuild(guild);
    setMessages([]);
    setPresence([]);
    socket.emit("join-room", { guildId: guild.id });
    setJoined(true);
  }

  function createGuild() {
    const name = newGuildName.trim();
    if (!socket || !name) return;

    socket.emit("guild:create", { name }, (result: any) => {
      if (!result?.ok) {
        setError(result?.error || "Sunucu oluşturulamadı.");
        return;
      }

      setNewGuildName("");
      setShowCreate(false);
      joinGuild(result.guild);
    });
  }

  function joinGuildByCode() {
    const code = joinCode.trim();
    if (!socket || !code) return;

    socket.emit("guild:join-code", { code }, (result: any) => {
      if (!result?.ok) {
        setError(result?.error || "Sunucu bulunamadı.");
        return;
      }

      setJoinCode("");
      setShowJoin(false);
      joinGuild(result.guild);
    });
  }

  async function leaveVoice(returnHome = true) {
    socket?.emit("leave-room");

    pcs.current.forEach(pc => pc.close());
    pcs.current.clear();
    videoSenders.current.clear();

    stopCameraAndScreen();

    if (returnHome) {
      setJoined(false);
      setActiveGuild(null);
      setPresence([]);
      setMessages([]);
    }
  }

  function stopCameraAndScreen() {
    outgoingVideoTrack.current?.stop();
    outgoingVideoTrack.current = null;
    cameraTrack.current?.stop();
    cameraTrack.current = null;

    videoSenders.current.forEach(sender => {
      sender.replaceTrack(null).catch(() => {});
    });

    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    setCameraOn(false);
    setScreenOn(false);
  }

  function stopAllMedia() {
    stopCameraAndScreen();
    localStream.current?.getTracks().forEach(t => t.stop());
    localStream.current = null;
    remoteAudio.current.forEach(a => a.pause());
    remoteAudio.current.clear();
  }

  function sendMessage() {
    if (!socket || !joined || !activeGuild) return;
    const value = text.trim();
    if (!value) return;

    socket.emit("chat-message", {
      guildId: activeGuild.id,
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

  async function setOutboundVideo(track: MediaStreamTrack | null) {
    outgoingVideoTrack.current = track;

    await Promise.all(
      [...videoSenders.current.values()].map(sender =>
        sender.replaceTrack(track).catch(() => {})
      )
    );

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = track
        ? new MediaStream([track])
        : null;
    }
  }

  async function toggleCamera() {
    if (cameraOn) {
      cameraTrack.current?.stop();
      cameraTrack.current = null;
      setCameraOn(false);

      if (!screenOn) {
        await setOutboundVideo(null);
      }
      return;
    }

    try {
      const cam = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: false
      });

      cameraTrack.current = cam.getVideoTracks()[0];
      setCameraOn(true);

      if (!screenOn) {
        await setOutboundVideo(cameraTrack.current);
      }
    } catch (err: any) {
      setError(`Kamera açılamadı: ${err?.message || "izin verilmedi"}`);
    }
  }

  async function toggleScreen() {
    if (screenOn) {
      setScreenOn(false);
      await setOutboundVideo(cameraTrack.current);
      return;
    }

    try {
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: { ideal: 30 }
        },
        audio: false
      });

      const track = display.getVideoTracks()[0];
      setScreenOn(true);
      await setOutboundVideo(track);

      track.onended = async () => {
        setScreenOn(false);
        await setOutboundVideo(cameraTrack.current);
      };
    } catch (err: any) {
      setError(`Ekran paylaşımı açılamadı: ${err?.message || "iptal edildi"}`);
    }
  }

  if (!identified) {
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
              if (e.key === "Enter") identify();
            }}
            placeholder="Kullanıcı adın"
          />

          <button className="primary" onClick={identify} disabled={!connected}>
            Devam Et
          </button>

          {updateStatus && <div className="update-box">{updateStatus}</div>}
          {error && <div className="error-box">{error}</div>}
        </div>
      </div>
    );
  }

  if (!joined) {
    return (
      <div className="welcome-page">
        <div className="welcome-card guild-picker">
          <div className="picker-head">
            <div>
              <h1>Sunucular</h1>
              <p>Bir sunucu seç veya yenisini oluştur.</p>
            </div>
            <button className="icon-btn" onClick={() => setShowCreate(true)}>＋</button>
          </div>

          <div className="guild-list">
            {guilds.map(g => (
              <button className="guild-row" key={g.id} onClick={() => joinGuild(g)}>
                <span className="guild-badge">{g.name.slice(0, 2).toUpperCase()}</span>
                <span>
                  <b>{g.name}</b>
                  <small>Kod: {g.id}</small>
                </span>
              </button>
            ))}
          </div>

          <button className="secondary-wide" onClick={() => setShowJoin(true)}>
            Sunucu koduyla katıl
          </button>

          {showCreate && (
            <div className="modal-backdrop">
              <div className="modal">
                <h2>Yeni sunucu</h2>
                <input
                  autoFocus
                  placeholder="Sunucu adı"
                  value={newGuildName}
                  onChange={e => setNewGuildName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && createGuild()}
                />
                <div className="modal-actions">
                  <button onClick={() => setShowCreate(false)}>Vazgeç</button>
                  <button className="primary-small" onClick={createGuild}>Oluştur</button>
                </div>
              </div>
            </div>
          )}

          {showJoin && (
            <div className="modal-backdrop">
              <div className="modal">
                <h2>Sunucuya katıl</h2>
                <input
                  autoFocus
                  placeholder="Sunucu kodu"
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && joinGuildByCode()}
                />
                <div className="modal-actions">
                  <button onClick={() => setShowJoin(false)}>Vazgeç</button>
                  <button className="primary-small" onClick={joinGuildByCode}>Katıl</button>
                </div>
              </div>
            </div>
          )}

          {error && <div className="error-box">{error}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <aside className="servers">
        <div className="server-logo">E</div>

        {guilds.map(g => (
          <button
            key={g.id}
            title={`${g.name} • ${g.id}`}
            className={`server-circle ${activeGuild?.id === g.id ? "active" : ""}`}
            onClick={() => joinGuild(g)}
          >
            {g.name.slice(0, 2).toUpperCase()}
          </button>
        ))}

        <button className="server-circle add" onClick={() => {
          setJoined(false);
          setShowCreate(true);
        }}>+</button>
      </aside>

      <aside className="channels">
        <div className="guild-title">
          <span>{activeGuild?.name}</span>
          <small className="guild-code">#{activeGuild?.id}</small>
        </div>

        <div className="channel-group">
          <div className="channel-title">TEXT CHANNELS</div>
          <button className="channel active"># general</button>
          <button className="channel"># music</button>
        </div>

        <div className="channel-group">
          <div className="channel-title">VOICE CHANNELS</div>
          <button className="channel voice active">🔊 Lobby</button>

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
          <div className="user-avatar">{username.slice(0, 2).toUpperCase()}</div>
          <div className="user-info">
            <b>{username}</b>
            <small>Voice connected</small>
          </div>
          <button onClick={toggleMute}>{muted ? "🔇" : "🎙️"}</button>
        </div>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <b># general</b>
            <span>{activeGuild?.name}</span>
          </div>
          <div className="top-state">✨ Noise suppression</div>
        </header>

        <div className="video-zone">
          <video
            ref={localVideoRef}
            muted
            autoPlay
            playsInline
            className={cameraOn || screenOn ? "local-video" : "hidden"}
          />
          <div ref={remoteVideoHost} className="remote-video-host" />
        </div>

        <section className="message-list">
          <div className="channel-intro">
            <div className="big-hash">#</div>
            <h2># general'a hoş geldin</h2>
            <p>{activeGuild?.name} sohbetinin başlangıcı.</p>
          </div>

          {messages.map(m => (
            <div className="message" key={m.id}>
              <div className={`avatar ${m.bot ? "bot" : ""}`}>
                {m.bot ? "EB" : m.username.slice(0, 2).toUpperCase()}
              </div>
              <div className="message-body">
                <div className="message-meta">
                  <b>{m.username}</b>
                  <small>{new Date(m.createdAt).toLocaleTimeString()}</small>
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
            onKeyDown={e => e.key === "Enter" && sendMessage()}
            placeholder="#general kanalına mesaj gönder"
          />
          <button onClick={() => setText(v => v + " 😂")}>😂</button>
          <button className="send" onClick={sendMessage}>Gönder</button>
        </div>

        <div className="call-controls">
          <button className={muted ? "danger" : ""} onClick={toggleMute}>
            {muted ? "🔇 Mikrofon kapalı" : "🎙️ Mikrofon"}
          </button>

          <button className={cameraOn ? "active-control" : ""} onClick={toggleCamera}>
            📹 {cameraOn ? "Kamerayı kapat" : "Kamera"}
          </button>

          <button className={screenOn ? "active-control" : ""} onClick={toggleScreen}>
            🖥️ {screenOn ? "Paylaşımı durdur" : "Ekran paylaş"}
          </button>

          <button className="disconnect-btn" onClick={() => leaveVoice(true)}>
            ☎ Disconnect
          </button>

          <span className="connection">● {connected ? "Online" : "Offline"}</span>
        </div>

        {error && (
          <div className="floating-error" onClick={() => setError("")}>{error}</div>
        )}
      </main>

      <aside className="members">
        <div className="members-title">ONLINE — {presence.length}</div>
        {presence.map(p => (
          <div className="member" key={p.socketId}>
            <div className="avatar">{p.username.slice(0, 2).toUpperCase()}</div>
            <span>{p.username}</span>
          </div>
        ))}

        <div className="members-title bots">BOTS — 1</div>
        <div className="member">
          <div className="avatar bot">EB</div>
          <div>
            <span>EchoBot</span>
            <small className="bot-help">!help</small>
          </div>
        </div>
      </aside>

      {showCreate && (
        <div className="modal-backdrop">
          <div className="modal">
            <h2>Yeni sunucu</h2>
            <input
              autoFocus
              placeholder="Sunucu adı"
              value={newGuildName}
              onChange={e => setNewGuildName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && createGuild()}
            />
            <div className="modal-actions">
              <button onClick={() => setShowCreate(false)}>Vazgeç</button>
              <button className="primary-small" onClick={createGuild}>Oluştur</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
