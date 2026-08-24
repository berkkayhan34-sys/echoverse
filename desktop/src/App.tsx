import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

type PeerInfo = {
  socketId: string;
  userId: string;
  username: string;
  avatarData?: string | null;
};

type Account = {
  id: string;
  email: string;
  username: string;
  avatarData?: string | null;
};

type ChatMessage = {
  id: string;
  username: string;
  avatarData?: string | null;
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

type ScreenSource = {
  id: string;
  name: string;
  thumbnail?: string;
  appIcon?: string;
};

type SpotifyState = {
  guildId?: string;
  leaderSocketId?: string;
  leaderUsername?: string;
  active?: boolean;
  trackUri?: string;
  trackName?: string;
  artistName?: string;
  albumImage?: string;
  positionMs?: number;
  isPlaying?: boolean;
  updatedAt?: number;
};

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" }
];

export default function App() {
  const [serverUrl, setServerUrl] = useState("");
  const [spotifyConfigured, setSpotifyConfigured] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [username, setUsername] = useState(
    () => localStorage.getItem("echoverse_username") || ""
  );
  const [account, setAccount] = useState<Account | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authUsername, setAuthUsername] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
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
  const [appVersion, setAppVersion] = useState("1.4.0");
  const [screenSources, setScreenSources] = useState<ScreenSource[]>([]);
  const [showScreenPicker, setShowScreenPicker] = useState(false);
  const [screenPermission, setScreenPermission] = useState("");

  const [peerVolumes, setPeerVolumes] = useState<Record<string, number>>({});
  const [peerMuted, setPeerMuted] = useState<Record<string, boolean>>({});
  const [speakingPeers, setSpeakingPeers] = useState<Record<string, boolean>>({});
  const [localSpeaking, setLocalSpeaking] = useState(false);

  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [spotifyName, setSpotifyName] = useState("");
  const [spotifyParty, setSpotifyParty] = useState<SpotifyState | null>(null);
  const [spotifyFollowing, setSpotifyFollowing] = useState(false);
  const [spotifyLeader, setSpotifyLeader] = useState(false);
  const [spotifyMessage, setSpotifyMessage] = useState("");

  const localStream = useRef<MediaStream | null>(null);
  const cameraTrack = useRef<MediaStreamTrack | null>(null);
  const screenTrack = useRef<MediaStreamTrack | null>(null);
  const outgoingVideoTrack = useRef<MediaStreamTrack | null>(null);
  const pcs = useRef<Map<string, RTCPeerConnection>>(new Map());
  const videoSenders = useRef<Map<string, RTCRtpSender>>(new Map());
  const remoteAudio = useRef<Map<string, HTMLAudioElement>>(new Map());
  const remoteVideoHost = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const spotifyLeaderTimer = useRef<number | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const speakingIntervals = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    (async () => {
      const cfg = window.echoverse
        ? await window.echoverse.getConfig()
        : {
            serverUrl: "http://localhost:3001",
            spotifyClientId: ""
          };

      setServerUrl(cfg.serverUrl);
      setSpotifyConfigured(
        !!cfg.spotifyClientId &&
        !cfg.spotifyClientId.startsWith("SPOTIFY_CLIENT_ID")
      );

      await refreshSpotifyStatus();

      try {
        const version = await window.echoverse?.getVersion?.();
        if (version) setAppVersion(version);
      } catch {}
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

      const token = localStorage.getItem("echoverse_token");

      if (token) {
        s.emit("auth:resume", { token }, (result: any) => {
          if (!result?.ok) {
            localStorage.removeItem("echoverse_token");
            setAccount(null);
            setIdentified(false);
            return;
          }

          localStorage.setItem("echoverse_token", result.token);
          localStorage.setItem("echoverse_username", result.account.username);
          setUsername(result.account.username);
          setAccount(result.account);
          setIdentified(true);
        });
      }
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

      try {
        if (pc.signalingState !== "stable") {
          await pc.setLocalDescription({ type: "rollback" } as RTCSessionDescriptionInit);
        }
      } catch {}

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

      try {
        await pc.addIceCandidate(candidate);
      } catch {}
    });

    s.on("spotify:party-state", (state: SpotifyState) => {
      setSpotifyParty(state);
      setSpotifyLeader(state.leaderSocketId === s.id);
    });

    s.on("spotify:party-ended", () => {
      setSpotifyParty(null);
      setSpotifyFollowing(false);
      setSpotifyLeader(false);
      stopSpotifyLeaderTimer();
      setSpotifyMessage("Spotify Together sona erdi.");
    });

    s.on("spotify:sync", async (state: SpotifyState) => {
      setSpotifyParty(state);

      if (!spotifyFollowing || state.leaderSocketId === s.id) return;

      try {
        await window.echoverse?.spotifyApplySync?.(state);
        setSpotifyMessage(
          state.trackName
            ? `🎵 ${state.trackName} • ${state.artistName || ""}`
            : "Spotify senkronize."
        );
      } catch (err: any) {
        setSpotifyMessage(
          err?.message ||
          "Spotify senkronizasyonu başarısız."
        );
      }
    });

    return () => {
      s.disconnect();
      stopSpotifyLeaderTimer();
      stopAllMedia();
    };
  }, [serverUrl, spotifyFollowing]);

  useEffect(() => {
    for (const [peerId, audio] of remoteAudio.current.entries()) {
      const volume = peerVolumes[peerId] ?? 100;
      const isMuted = !!peerMuted[peerId];
      audio.volume = isMuted ? 0 : Math.max(0, Math.min(1, volume / 100));
    }
  }, [peerVolumes, peerMuted]);

  useEffect(() => {
    const host = remoteVideoHost.current;
    if (!host) return;

    for (const [peerId, isSpeaking] of Object.entries(speakingPeers)) {
      host
        .querySelector<HTMLVideoElement>(`video[data-peer="${peerId}"]`)
        ?.classList.toggle("speaking-video", !!isSpeaking);
    }
  }, [speakingPeers]);

  useEffect(() => {
    const closeFocused = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        document
          .querySelectorAll(".video-maximized")
          .forEach(el => el.classList.remove("video-maximized"));
      }
    };

    window.addEventListener("keydown", closeFocused);
    return () => window.removeEventListener("keydown", closeFocused);
  }, []);


  function getAudioContext() {
    if (!audioContext.current) {
      audioContext.current = new AudioContext();
    }
    return audioContext.current;
  }

  function stopSpeakingMonitor(peerId: string) {
    const interval = speakingIntervals.current.get(peerId);
    if (interval !== undefined) {
      window.clearInterval(interval);
      speakingIntervals.current.delete(peerId);
    }

    if (peerId === "local") {
      setLocalSpeaking(false);
    } else {
      setSpeakingPeers(prev => {
        if (!(peerId in prev)) return prev;
        const next = { ...prev };
        delete next[peerId];
        return next;
      });
    }
  }

  function startSpeakingMonitor(peerId: string, stream: MediaStream) {
    stopSpeakingMonitor(peerId);

    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;

    try {
      const ctx = getAudioContext();
      const source = ctx.createMediaStreamSource(
        new MediaStream([audioTrack])
      );
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.72;
      source.connect(analyser);

      const data = new Uint8Array(analyser.fftSize);
      let last = false;

      const interval = window.setInterval(() => {
        if (audioTrack.readyState === "ended") {
          stopSpeakingMonitor(peerId);
          return;
        }

        analyser.getByteTimeDomainData(data);

        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const value = (data[i] - 128) / 128;
          sum += value * value;
        }

        const rms = Math.sqrt(sum / data.length);
        const speaking = rms > 0.035;

        if (speaking === last) return;
        last = speaking;

        if (peerId === "local") {
          setLocalSpeaking(speaking);
        } else {
          setSpeakingPeers(prev => ({
            ...prev,
            [peerId]: speaking
          }));
        }
      }, 90);

      speakingIntervals.current.set(peerId, interval);
    } catch (err) {
      console.warn("Speaking monitor error", err);
    }
  }

  async function refreshSpotifyStatus() {
    try {
      const status = await window.echoverse?.spotifyStatus?.();
      if (!status) return;

      setSpotifyConfigured(status.configured);
      setSpotifyConnected(status.connected);
      setSpotifyName(status.displayName || "");

      if (status.error && status.configured) {
        setSpotifyMessage(status.error);
      }
    } catch {}
  }

  async function spotifyLogin() {
    try {
      setSpotifyMessage("Spotify giriş sayfası açılıyor…");
      await window.echoverse?.spotifyLogin?.();
      await refreshSpotifyStatus();
      setSpotifyMessage("Spotify bağlandı ✅");
    } catch (err: any) {
      setSpotifyMessage(err?.message || "Spotify bağlanamadı.");
    }
  }

  async function spotifyLogout() {
    await window.echoverse?.spotifyLogout?.();
    setSpotifyConnected(false);
    setSpotifyName("");
    setSpotifyFollowing(false);
    setSpotifyLeader(false);
    stopSpotifyLeaderTimer();
    setSpotifyMessage("Spotify bağlantısı kaldırıldı.");
  }

  function stopSpotifyLeaderTimer() {
    if (spotifyLeaderTimer.current !== null) {
      window.clearInterval(spotifyLeaderTimer.current);
      spotifyLeaderTimer.current = null;
    }
  }

  async function broadcastSpotifyState() {
    if (!socket || !activeGuild) return;

    try {
      const state = await window.echoverse?.spotifyPlayback?.();
      if (!state) {
        setSpotifyMessage("Spotify'da önce bir şarkı aç.");
        return;
      }

      socket.emit("spotify:sync", {
        guildId: activeGuild.id,
        state
      });

      setSpotifyParty({
        ...state,
        guildId: activeGuild.id,
        leaderSocketId: socket.id,
        leaderUsername: username,
        active: true,
        updatedAt: Date.now()
      });

      setSpotifyMessage(`🎵 ${state.trackName} • ${state.artistName}`);
    } catch (err: any) {
      setSpotifyMessage(err?.message || "Spotify okunamadı.");
    }
  }

  async function startSpotifyParty() {
    if (!socket || !activeGuild || !spotifyConnected) return;

    setSpotifyFollowing(false);
    setSpotifyLeader(true);

    socket.emit("spotify:party-start", {
      guildId: activeGuild.id
    });

    await broadcastSpotifyState();

    stopSpotifyLeaderTimer();

    spotifyLeaderTimer.current = window.setInterval(() => {
      broadcastSpotifyState();
    }, 2000);
  }

  function stopSpotifyParty() {
    if (!socket || !activeGuild) return;

    socket.emit("spotify:party-stop", {
      guildId: activeGuild.id
    });

    stopSpotifyLeaderTimer();
    setSpotifyLeader(false);
    setSpotifyParty(null);
    setSpotifyMessage("Spotify Together durduruldu.");
  }

  async function followSpotifyParty() {
    if (!spotifyConnected) {
      setSpotifyMessage("Önce Spotify hesabını bağla.");
      return;
    }

    setSpotifyFollowing(true);

    if (spotifyParty?.trackUri) {
      try {
        await window.echoverse?.spotifyApplySync?.(spotifyParty);
        setSpotifyMessage(
          `Takip ediliyor: ${spotifyParty.trackName || "Spotify"}`
        );
      } catch (err: any) {
        setSpotifyMessage(
          err?.message ||
          "Spotify uygulamasında önce bir şarkı aç."
        );
      }
    }
  }

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
    startSpeakingMonitor("local", stream);
    return stream;
  }

  async function createPeer(
    s: Socket,
    peerId: string,
    initiator: boolean
  ) {
    const existing = pcs.current.get(peerId);
    if (existing) return existing;

    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS
    });

    pcs.current.set(peerId, pc);

    const stream = await ensureMicrophone();

    stream.getAudioTracks().forEach(track => {
      pc.addTrack(track, stream);
    });

    const videoTransceiver = pc.addTransceiver("video", {
      direction: "sendrecv"
    });

    videoSenders.current.set(
      peerId,
      videoTransceiver.sender
    );

    if (outgoingVideoTrack.current) {
      await videoTransceiver.sender.replaceTrack(
        outgoingVideoTrack.current
      );
    }

    pc.onicecandidate = evt => {
      if (evt.candidate) {
        s.emit("webrtc-ice", {
          to: peerId,
          candidate: evt.candidate
        });
      }
    };

    pc.ontrack = evt => {
      const streamForTrack =
        evt.streams[0] ||
        new MediaStream([evt.track]);

      if (evt.track.kind === "audio") {
        let audio = remoteAudio.current.get(peerId);

        if (!audio) {
          audio = new Audio();
          audio.autoplay = true;
          remoteAudio.current.set(peerId, audio);
        }

        audio.srcObject = streamForTrack;
        startSpeakingMonitor(peerId, streamForTrack);

        const volume = peerVolumes[peerId] ?? 100;
        audio.volume = peerMuted[peerId]
          ? 0
          : volume / 100;

        audio.play().catch(() => {});
      }

      if (evt.track.kind === "video") {
        attachRemoteVideo(peerId, evt.track);

        evt.track.onunmute = () => {
          attachRemoteVideo(peerId, evt.track);
        };
      }
    };

    pc.onconnectionstatechange = () => {
      if (
        ["failed", "closed"].includes(
          pc.connectionState
        )
      ) {
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
    stopSpeakingMonitor(peerId);
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
      ?.querySelector(
        `[data-peer="${peerId}"]`
      )
      ?.remove();
  }

  function attachRemoteVideo(
    peerId: string,
    track: MediaStreamTrack
  ) {
    const host = remoteVideoHost.current;
    if (!host) return;

    let video =
      host.querySelector<HTMLVideoElement>(
        `video[data-peer="${peerId}"]`
      );

    if (!video) {
      video = document.createElement("video");
      video.dataset.peer = peerId;
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true;
      video.className = "remote-video";
      video.title = "Büyütmek için tıkla • ESC ile çık";
      video.onclick = () => {
        document
          .querySelectorAll(".video-maximized")
          .forEach(el => {
            if (el !== video) el.classList.remove("video-maximized");
          });

        video.classList.toggle("video-maximized");
      };
      host.appendChild(video);
    }

    const videoOnlyStream = new MediaStream([track]);
    video.srcObject = videoOnlyStream;
    video.play().catch(() => {});
  }

  async function authSubmit() {
    if (!socket || !connected || authBusy) return;

    const email = authEmail.trim();
    const password = authPassword;

    if (!email || !password) {
      setError("E-posta ve şifreyi doldur.");
      return;
    }

    if (authMode === "register" && authUsername.trim().length < 3) {
      setError("Kullanıcı adı en az 3 karakter olmalı.");
      return;
    }

    setAuthBusy(true);
    setError("");

    const event = authMode === "register"
      ? "auth:register"
      : "auth:login";

    const payload = authMode === "register"
      ? {
          email,
          username: authUsername.trim(),
          password
        }
      : {
          email,
          password
        };

    socket.emit(event, payload, async (result: any) => {
      setAuthBusy(false);

      if (!result?.ok) {
        setError(result?.error || "İşlem başarısız.");
        return;
      }

      localStorage.setItem("echoverse_token", result.token);
      localStorage.setItem("echoverse_username", result.account.username);

      setAccount(result.account);
      setUsername(result.account.username);
      setIdentified(true);
      setAuthPassword("");
      setError("");

      try {
        await ensureMicrophone();
      } catch (err: any) {
        setError(
          `Giriş yapıldı ama mikrofon açılamadı: ${
            err?.message || "izin verilmedi"
          }`
        );
      }
    });
  }

  function logout() {
    socket?.emit("auth:logout");
    localStorage.removeItem("echoverse_token");
    localStorage.removeItem("echoverse_username");
    setAccount(null);
    setIdentified(false);
    setJoined(false);
    setActiveGuild(null);
    setPresence([]);
    setMessages([]);
  }

  async function resizeAvatar(file: File) {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Dosya okunamadı."));
      reader.onload = () => resolve(String(reader.result || ""));
      reader.readAsDataURL(file);
    });

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Görsel açılamadı."));
      image.src = dataUrl;
    });

    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Görsel işlenemedi.");

    const crop = Math.min(img.width, img.height);
    const sx = (img.width - crop) / 2;
    const sy = (img.height - crop) / 2;

    ctx.drawImage(
      img,
      sx,
      sy,
      crop,
      crop,
      0,
      0,
      size,
      size
    );

    return canvas.toDataURL("image/jpeg", 0.82);
  }

  async function changeAvatar(file?: File) {
    if (!socket || !file) return;

    try {
      const avatarData = await resizeAvatar(file);
      const token = localStorage.getItem("echoverse_token");

      socket.emit(
        "profile:set-avatar",
        { token, avatarData },
        (result: any) => {
          if (!result?.ok) {
            setError(result?.error || "Profil fotoğrafı değiştirilemedi.");
            return;
          }

          setAccount(result.account);
          setError("");
        }
      );
    } catch (err: any) {
      setError(err?.message || "Profil fotoğrafı değiştirilemedi.");
    }
  }

  async function identify() {
    if (!socket || !connected) return;

    const token = localStorage.getItem("echoverse_token");

    if (!token) {
      setIdentified(false);
      return;
    }

    socket.emit("auth:resume", { token }, async (result: any) => {
      if (!result?.ok) {
        localStorage.removeItem("echoverse_token");
        setIdentified(false);
        setAccount(null);
        return;
      }

      localStorage.setItem("echoverse_token", result.token);
      setAccount(result.account);
      setUsername(result.account.username);
      setIdentified(true);

      try {
        await ensureMicrophone();
      } catch {}
    });
  }

  async function joinGuild(guild: Guild) {
    if (!socket) return;

    await leaveVoice(false);

    setActiveGuild(guild);
    setMessages([]);
    setPresence([]);
    setSpotifyParty(null);
    setSpotifyFollowing(false);
    setSpotifyLeader(false);

    socket.emit("join-room", {
      guildId: guild.id
    });

    setJoined(true);
  }

  function createGuild() {
    const name = newGuildName.trim();
    if (!socket || !name) return;

    socket.emit(
      "guild:create",
      { name },
      (result: any) => {
        if (!result?.ok) {
          setError(
            result?.error ||
            "Sunucu oluşturulamadı."
          );
          return;
        }

        setNewGuildName("");
        setShowCreate(false);
        joinGuild(result.guild);
      }
    );
  }

  function joinGuildByCode() {
    const code = joinCode.trim();
    if (!socket || !code) return;

    socket.emit(
      "guild:join-code",
      { code },
      (result: any) => {
        if (!result?.ok) {
          setError(
            result?.error ||
            "Sunucu bulunamadı."
          );
          return;
        }

        setJoinCode("");
        setShowJoin(false);
        joinGuild(result.guild);
      }
    );
  }

  async function leaveVoice(returnHome = true) {
    socket?.emit("leave-room");

    pcs.current.forEach(pc => pc.close());
    pcs.current.clear();
    videoSenders.current.clear();

    stopCameraAndScreen();
    stopSpotifyLeaderTimer();

    setSpotifyFollowing(false);
    setSpotifyLeader(false);
    setSpotifyParty(null);

    if (returnHome) {
      setJoined(false);
      setActiveGuild(null);
      setPresence([]);
      setMessages([]);
    }
  }

  function stopCameraAndScreen() {
    screenTrack.current?.stop();
    screenTrack.current = null;

    cameraTrack.current?.stop();
    cameraTrack.current = null;

    outgoingVideoTrack.current = null;

    videoSenders.current.forEach(sender => {
      sender.replaceTrack(null).catch(() => {});
    });

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    setCameraOn(false);
    setScreenOn(false);
  }

  function stopAllMedia() {
    for (const peerId of [...speakingIntervals.current.keys()]) {
      stopSpeakingMonitor(peerId);
    }

    stopCameraAndScreen();

    localStream.current
      ?.getTracks()
      .forEach(t => t.stop());

    localStream.current = null;

    remoteAudio.current.forEach(a => a.pause());
    remoteAudio.current.clear();
  }

  function sendMessage() {
    if (
      !socket ||
      !joined ||
      !activeGuild
    ) return;

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

    stream.getAudioTracks().forEach(
      track => {
        track.enabled = !next;
      }
    );

    setMuted(next);
  }

  function setPeerVolume(
    peerId: string,
    volume: number
  ) {
    setPeerVolumes(prev => ({
      ...prev,
      [peerId]: volume
    }));

    const audio =
      remoteAudio.current.get(peerId);

    if (audio && !peerMuted[peerId]) {
      audio.volume = volume / 100;
    }
  }

  function togglePeerMute(peerId: string) {
    const next = !peerMuted[peerId];

    setPeerMuted(prev => ({
      ...prev,
      [peerId]: next
    }));

    const audio =
      remoteAudio.current.get(peerId);

    if (audio) {
      audio.volume = next
        ? 0
        : (peerVolumes[peerId] ?? 100) / 100;
    }
  }

  async function renegotiateVideo() {
    if (!socket) return;

    for (const [peerId, pc] of pcs.current.entries()) {
      try {
        if (pc.signalingState !== "stable") continue;

        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true
        });

        await pc.setLocalDescription(offer);

        socket.emit("webrtc-offer", {
          to: peerId,
          sdp: offer
        });
      } catch (err) {
        console.warn("Video renegotiation failed", peerId, err);
      }
    }
  }

  async function setOutboundVideo(
    track: MediaStreamTrack | null
  ) {
    outgoingVideoTrack.current = track;

    await Promise.all(
      [...videoSenders.current.values()].map(
        sender =>
          sender
            .replaceTrack(track)
            .catch(() => {})
      )
    );

    if (localVideoRef.current) {
      localVideoRef.current.srcObject =
        track
          ? new MediaStream([track])
          : null;
    }

    // Chromium/macOS interop: renegotiate after replacing a previously
    // inactive video sender so the receiver immediately renders the track.
    await renegotiateVideo();
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
      const cam =
        await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 }
          },
          audio: false
        });

      cameraTrack.current =
        cam.getVideoTracks()[0];

      setCameraOn(true);

      if (!screenOn) {
        await setOutboundVideo(
          cameraTrack.current
        );
      }
    } catch (err: any) {
      setError(
        `Kamera açılamadı: ${
          err?.message || "izin verilmedi"
        }`
      );
    }
  }

  async function toggleScreen() {
    if (screenOn) {
      const old = screenTrack.current;
      screenTrack.current = null;

      if (old) {
        old.onended = null;
        old.stop();
      }

      setScreenOn(false);
      await setOutboundVideo(cameraTrack.current);
      return;
    }

    try {
      const permission = await window.echoverse?.screenPermission?.();
      setScreenPermission(permission || "");

      const sources = await window.echoverse?.listScreenSources?.();

      if (!sources || sources.length === 0) {
        if (
          permission === "denied" ||
          permission === "restricted" ||
          permission === "not-determined"
        ) {
          setError(
            "macOS ekran kaydı izni gerekli. Sistem Ayarları → Gizlilik ve Güvenlik → Ekran ve Sistem Ses Kaydı bölümünden EchoVerse'e izin ver, sonra EchoVerse'i tamamen kapatıp tekrar aç."
          );
          await window.echoverse?.openScreenSettings?.();
        } else {
          setError("Paylaşılabilecek ekran/pencere bulunamadı.");
        }
        return;
      }

      setScreenSources(sources);
      setShowScreenPicker(true);
    } catch (err: any) {
      setError(
        `Ekran kaynakları alınamadı: ${
          err?.message || "bilinmeyen hata"
        }`
      );
    }
  }

  async function beginScreenShare(source: ScreenSource) {
    try {
      await window.echoverse?.selectScreenSource?.(source.id);
      setShowScreenPicker(false);

      const display =
        await navigator.mediaDevices.getDisplayMedia({
          video: {
            frameRate: { ideal: 30 }
          },
          audio: false
        });

      const track = display.getVideoTracks()[0];

      if (!track) {
        throw new Error("Ekran kaynağı açılamadı.");
      }

      screenTrack.current = track;
      setScreenOn(true);
      await setOutboundVideo(track);

      track.onended = async () => {
        if (screenTrack.current?.id !== track.id) return;

        screenTrack.current = null;
        setScreenOn(false);
        await setOutboundVideo(cameraTrack.current);
      };
    } catch (err: any) {
      setShowScreenPicker(false);

      const permission = await window.echoverse?.screenPermission?.();
      setScreenPermission(permission || "");

      if (
        permission === "denied" ||
        permission === "restricted"
      ) {
        setError(
          "macOS EchoVerse'e ekran kaydı izni vermemiş. Sistem Ayarları → Gizlilik ve Güvenlik → Ekran ve Sistem Ses Kaydı → EchoVerse'i aç ve uygulamayı yeniden başlat."
        );
        await window.echoverse?.openScreenSettings?.();
      } else {
        setError(
          `Ekran paylaşımı açılamadı: ${
            err?.message || "iptal edildi"
          }`
        );
      }
    }
  }

  if (!identified) {
    return (
      <div className="welcome-page">
        <div className="welcome-card auth-card">
          <div className="logo-orb">E</div>
          <h1>EchoVerse</h1>
          <p>Arkadaşlarınla konuş, yazış, izle.</p>

          <div className={`server-state ${connected ? "online" : "offline"}`}>
            <span className="dot" />
            {connected ? "EchoVerse sunucusu online" : "Sunucuya bağlanıyor..."}
          </div>

          <div className="auth-tabs">
            <button
              className={authMode === "login" ? "active" : ""}
              onClick={() => {
                setAuthMode("login");
                setError("");
              }}
            >
              Giriş Yap
            </button>

            <button
              className={authMode === "register" ? "active" : ""}
              onClick={() => {
                setAuthMode("register");
                setError("");
              }}
            >
              Kayıt Ol
            </button>
          </div>

          {authMode === "register" && (
            <>
              <label>Kullanıcı adı</label>
              <input
                value={authUsername}
                maxLength={28}
                onChange={e => setAuthUsername(e.target.value)}
                placeholder="Kullanıcı adın"
              />
            </>
          )}

          <label>E-posta</label>
          <input
            type="email"
            value={authEmail}
            onChange={e => setAuthEmail(e.target.value)}
            placeholder="mail@example.com"
          />

          <label>Şifre</label>
          <input
            type="password"
            value={authPassword}
            onChange={e => setAuthPassword(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") authSubmit();
            }}
            placeholder="En az 6 karakter"
          />

          <button
            className="primary"
            onClick={authSubmit}
            disabled={!connected || authBusy}
          >
            {authBusy
              ? "Bekle…"
              : authMode === "register"
                ? "Hesap Oluştur"
                : "Giriş Yap"}
          </button>

          {updateStatus && <div className="update-box">{updateStatus}</div>}
          {error && <div className="error-box">{error}</div>}

          <small className="auth-version">EchoVerse v{appVersion}</small>
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
              <p>
                Bir sunucu seç veya yenisini
                oluştur.
              </p>
            </div>

            <button
              className="icon-btn"
              onClick={() =>
                setShowCreate(true)
              }
            >
              ＋
            </button>
          </div>

          <div className="guild-list">
            {guilds.map(g => (
              <button
                className="guild-row"
                key={g.id}
                onClick={() => joinGuild(g)}
              >
                <span className="guild-badge">
                  {g.name
                    .slice(0, 2)
                    .toUpperCase()}
                </span>

                <span>
                  <b>{g.name}</b>
                  <small>Kod: {g.id}</small>
                </span>
              </button>
            ))}
          </div>

          <button
            className="secondary-wide"
            onClick={() =>
              setShowJoin(true)
            }
          >
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
                  onChange={e =>
                    setNewGuildName(
                      e.target.value
                    )
                  }
                  onKeyDown={e =>
                    e.key === "Enter" &&
                    createGuild()
                  }
                />

                <div className="modal-actions">
                  <button
                    onClick={() =>
                      setShowCreate(false)
                    }
                  >
                    Vazgeç
                  </button>

                  <button
                    className="primary-small"
                    onClick={createGuild}
                  >
                    Oluştur
                  </button>
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
                  onChange={e =>
                    setJoinCode(
                      e.target.value
                    )
                  }
                  onKeyDown={e =>
                    e.key === "Enter" &&
                    joinGuildByCode()
                  }
                />

                <div className="modal-actions">
                  <button
                    onClick={() =>
                      setShowJoin(false)
                    }
                  >
                    Vazgeç
                  </button>

                  <button
                    className="primary-small"
                    onClick={joinGuildByCode}
                  >
                    Katıl
                  </button>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="error-box">
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <aside className="servers">
        <div className="server-logo">
          E
        </div>

        {guilds.map(g => (
          <button
            key={g.id}
            title={`${g.name} • ${g.id}`}
            className={`server-circle ${
              activeGuild?.id === g.id
                ? "active"
                : ""
            }`}
            onClick={() => joinGuild(g)}
          >
            {g.name
              .slice(0, 2)
              .toUpperCase()}
          </button>
        ))}

        <button
          className="server-circle add"
          onClick={() => {
            setJoined(false);
            setShowCreate(true);
          }}
        >
          +
        </button>
      </aside>

      <aside className="channels">
        <div className="guild-title">
          <span>{activeGuild?.name}</span>
          <small className="guild-code">
            #{activeGuild?.id}
          </small>
        </div>

        <div className="channel-group">
          <div className="channel-title">
            TEXT CHANNELS
          </div>
          <button className="channel active">
            # general
          </button>
          <button className="channel">
            # music
          </button>
        </div>

        <div className="channel-group">
          <div className="channel-title">
            VOICE CHANNELS
          </div>

          <button className="channel voice active">
            🔊 Lobby
          </button>

          <div className="voice-users">
            {presence.map(p => {
              const isSelf = p.socketId === socket?.id;
              const speaking = isSelf
                ? localSpeaking && !muted
                : !!speakingPeers[p.socketId] && !peerMuted[p.socketId];

              return (
                <div
                  className={`voice-user-row ${speaking ? "speaking" : ""}`}
                  key={p.socketId}
                >
                  <div className="voice-user">
                    {p.avatarData ? (
                      <img className="voice-avatar" src={p.avatarData} alt="" />
                    ) : (
                      <span className="mini-dot" />
                    )}
                    {p.username}
                    {isSelf ? " (sen)" : ""}
                  </div>

                  {!isSelf && (
                    <div className="voice-peer-controls">
                      <button
                        className={peerMuted[p.socketId] ? "peer-muted" : ""}
                        onClick={() => togglePeerMute(p.socketId)}
                        title="Sadece sende sustur"
                      >
                        {peerMuted[p.socketId] ? "🔇" : "🔊"}
                      </button>

                      <input
                        type="range"
                        min="0"
                        max="200"
                        value={peerVolumes[p.socketId] ?? 100}
                        onChange={e =>
                          setPeerVolume(
                            p.socketId,
                            Number(e.target.value)
                          )
                        }
                      />

                      <span>
                        {peerMuted[p.socketId]
                          ? "M"
                          : `${peerVolumes[p.socketId] ?? 100}%`}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="spotify-panel">
          <div className="spotify-head">
            <b>Spotify Together</b>
            <span className="spotify-dot" />
          </div>

          {!spotifyConfigured ? (
            <small>
              Spotify Client ID gerekli.
            </small>
          ) : !spotifyConnected ? (
            <button
              className="spotify-connect"
              onClick={spotifyLogin}
            >
              Spotify Bağla
            </button>
          ) : (
            <>
              <small>
                {spotifyName || "Spotify bağlı"}
              </small>

              {spotifyParty?.active && (
                <div className="spotify-now">
                  {spotifyParty.albumImage && (
                    <img
                      src={
                        spotifyParty.albumImage
                      }
                    />
                  )}

                  <div>
                    <b>
                      {spotifyParty.trackName ||
                        "Spotify Together"}
                    </b>
                    <small>
                      {spotifyParty.artistName ||
                        spotifyParty.leaderUsername}
                    </small>
                  </div>
                </div>
              )}

              {!spotifyParty?.active ? (
                <button
                  className="spotify-action"
                  onClick={startSpotifyParty}
                >
                  ▶ Party Başlat
                </button>
              ) : spotifyLeader ? (
                <button
                  className="spotify-stop"
                  onClick={stopSpotifyParty}
                >
                  ■ Party Durdur
                </button>
              ) : (
                <button
                  className={
                    spotifyFollowing
                      ? "spotify-following"
                      : "spotify-action"
                  }
                  onClick={followSpotifyParty}
                >
                  {spotifyFollowing
                    ? "✓ Senkron dinleniyor"
                    : "🎧 Birlikte Dinle"}
                </button>
              )}

              <button
                className="spotify-logout"
                onClick={spotifyLogout}
              >
                Spotify çıkış
              </button>
            </>
          )}

          {spotifyMessage && (
            <div className="spotify-message">
              {spotifyMessage}
            </div>
          )}
        </div>

        <div className="user-panel">
          <label
            className="user-avatar avatar-upload-label"
            title="Profil fotoğrafını değiştir"
          >
            {account?.avatarData ? (
              <img src={account.avatarData} alt="" />
            ) : (
              username.slice(0, 2).toUpperCase()
            )}

            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              onChange={e => {
                const file = e.target.files?.[0];
                changeAvatar(file);
                e.currentTarget.value = "";
              }}
            />
          </label>

          <div className="user-info">
            <b>{username}</b>
            <small>Voice connected • v{appVersion}</small>
          </div>

          <button onClick={toggleMute} title="Mikrofon">
            {muted ? "🔇" : "🎙️"}
          </button>

          <button onClick={logout} title="Çıkış yap">
            ↪
          </button>
        </div>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <b># general</b>
            <span>
              {activeGuild?.name}
            </span>
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
            className={
              cameraOn || screenOn
                ? `local-video ${localSpeaking && !muted ? "speaking-video" : ""}`
                : "hidden"
            }
          />

          <div
            ref={remoteVideoHost}
            className="remote-video-host"
          />
        </div>

        <section className="message-list">
          <div className="channel-intro">
            <div className="big-hash">
              #
            </div>

            <h2>
              # general'a hoş geldin
            </h2>

            <p>
              {activeGuild?.name} sohbetinin
              başlangıcı.
            </p>
          </div>

          {messages.map(m => (
            <div
              className="message"
              key={m.id}
            >
              <div className={`avatar ${m.bot ? "bot" : ""}`}>
                {!m.bot && m.avatarData ? (
                  <img src={m.avatarData} alt="" />
                ) : (
                  m.bot
                    ? "EB"
                    : m.username.slice(0, 2).toUpperCase()
                )}
              </div>

              <div className="message-body">
                <div className="message-meta">
                  <b>{m.username}</b>

                  <small>
                    {new Date(
                      m.createdAt
                    ).toLocaleTimeString()}
                  </small>
                </div>

                <div className="message-text">
                  {m.text}
                </div>
              </div>
            </div>
          ))}
        </section>

        <div className="composer">
          <button className="plus">
            +
          </button>

          <input
            value={text}
            onChange={e =>
              setText(e.target.value)
            }
            onKeyDown={e =>
              e.key === "Enter" &&
              sendMessage()
            }
            placeholder="#general kanalına mesaj gönder"
          />

          <button
            onClick={() =>
              setText(v => v + " 😂")
            }
          >
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
            className={
              muted ? "danger" : ""
            }
            onClick={toggleMute}
          >
            {muted
              ? "🔇 Mikrofon kapalı"
              : "🎙️ Mikrofon"}
          </button>

          <button
            className={
              cameraOn
                ? "active-control"
                : ""
            }
            onClick={toggleCamera}
          >
            📹{" "}
            {cameraOn
              ? "Kamerayı kapat"
              : "Kamera"}
          </button>

          <button
            className={
              screenOn
                ? "active-control"
                : ""
            }
            onClick={toggleScreen}
          >
            🖥️{" "}
            {screenOn
              ? "Paylaşımı durdur"
              : "Ekran paylaş"}
          </button>

          <button
            className="disconnect-btn"
            onClick={() =>
              leaveVoice(true)
            }
          >
            ☎ Disconnect
          </button>

          <span className="connection">
            ●{" "}
            {connected
              ? "Online"
              : "Offline"}
          </span>
        </div>

        {error && (
          <div
            className="floating-error"
            onClick={() =>
              setError("")
            }
          >
            {error}
          </div>
        )}
      </main>

      <aside className="members">
        <div className="members-title">
          ONLINE — {presence.length}
        </div>

        {presence.map(p => {
          const isSelf =
            p.socketId === socket?.id;

          return (
            <div
              className={`member-card ${
                (isSelf ? localSpeaking && !muted : speakingPeers[p.socketId] && !peerMuted[p.socketId])
                  ? "speaking"
                  : ""
              }`}
              key={p.socketId}
            >
              <div className="member">
                <div className="avatar">
                  {p.avatarData ? (
                    <img src={p.avatarData} alt="" />
                  ) : (
                    p.username.slice(0, 2).toUpperCase()
                  )}
                </div>

                <span>
                  {p.username}
                  {isSelf ? " (sen)" : ""}
                </span>
              </div>

              {!isSelf && (
                <div className="peer-audio-controls">
                  <button
                    className={
                      peerMuted[p.socketId]
                        ? "peer-muted"
                        : ""
                    }
                    onClick={() =>
                      togglePeerMute(
                        p.socketId
                      )
                    }
                    title="Sadece sende sustur"
                  >
                    {peerMuted[p.socketId]
                      ? "🔇"
                      : "🔊"}
                  </button>

                  <input
                    type="range"
                    min="0"
                    max="200"
                    value={
                      peerVolumes[
                        p.socketId
                      ] ?? 100
                    }
                    onChange={e =>
                      setPeerVolume(
                        p.socketId,
                        Number(
                          e.target.value
                        )
                      )
                    }
                  />

                  <span>
                    {peerMuted[p.socketId]
                      ? "MUTE"
                      : `${
                          peerVolumes[
                            p.socketId
                          ] ?? 100
                        }%`}
                  </span>
                </div>
              )}
            </div>
          );
        })}

        <div className="members-title bots">
          BOTS — 1
        </div>

        <div className="member">
          <div className="avatar bot">
            EB
          </div>

          <div>
            <span>EchoBot</span>
            <small className="bot-help">
              !help
            </small>
          </div>
        </div>
      </aside>


      {showScreenPicker && (
        <div className="modal-backdrop screen-picker-backdrop">
          <div className="modal screen-picker-modal">
            <div className="screen-picker-header">
              <div>
                <h2>Ekran veya pencere paylaş</h2>
                <p>Paylaşmak istediğin kaynağı seç.</p>
              </div>
              <button onClick={() => setShowScreenPicker(false)}>✕</button>
            </div>

            {screenPermission === "denied" && (
              <div className="screen-permission-warning">
                macOS ekran kaydı izni kapalı.
                <button
                  onClick={() => window.echoverse?.openScreenSettings?.()}
                >
                  Sistem Ayarlarını Aç
                </button>
              </div>
            )}

            <div className="screen-source-grid">
              {screenSources.map(source => (
                <button
                  className="screen-source-card"
                  key={source.id}
                  onClick={() => beginScreenShare(source)}
                >
                  <div className="screen-source-preview">
                    {source.thumbnail ? (
                      <img src={source.thumbnail} alt="" />
                    ) : (
                      <span>🖥️</span>
                    )}
                  </div>
                  <span>{source.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="modal-backdrop">
          <div className="modal">
            <h2>Yeni sunucu</h2>

            <input
              autoFocus
              placeholder="Sunucu adı"
              value={newGuildName}
              onChange={e =>
                setNewGuildName(
                  e.target.value
                )
              }
              onKeyDown={e =>
                e.key === "Enter" &&
                createGuild()
              }
            />

            <div className="modal-actions">
              <button
                onClick={() =>
                  setShowCreate(false)
                }
              >
                Vazgeç
              </button>

              <button
                className="primary-small"
                onClick={createGuild}
              >
                Oluştur
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
