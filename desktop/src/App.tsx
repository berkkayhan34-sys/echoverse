import React, { useEffect, useRef, useState } from "react";
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

type FriendUser = {
  id: string;
  username: string;
  avatarData?: string | null;
  friendshipId?: string;
  status?: "online" | "idle" | "dnd" | "invisible" | "offline";
};

type DmMessage = {
  id: string;
  senderId: string;
  recipientId: string;
  body: string;
  createdAt: string;
  senderUsername?: string;
  senderAvatarData?: string | null;
  replyToId?: string | null;
  editedAt?: string;
  attachmentName?: string | null;
  attachmentMime?: string | null;
  attachmentData?: string | null;
  reactions?: Record<string, string[]>;
  deletedAt?: string | null;
};

type IncomingCall = {
  callId: string;
  fromAccountId: string;
  fromSocketId: string;
  fromUsername: string;
  fromAvatarData?: string | null;
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
  const [appVersion, setAppVersion] = useState("1.6.9");
  const [screenSources, setScreenSources] = useState<ScreenSource[]>([]);
  const [showScreenPicker, setShowScreenPicker] = useState(false);
  const [screenPermission, setScreenPermission] = useState("");

  const [peerVolumes, setPeerVolumes] = useState<Record<string, number>>({});
  const [peerMuted, setPeerMuted] = useState<Record<string, boolean>>({});
  const [speakingPeers, setSpeakingPeers] = useState<Record<string, boolean>>({});
  const [localSpeaking, setLocalSpeaking] = useState(false);

  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedInput, setSelectedInput] = useState(
    () => localStorage.getItem("echoverse_input_device") || ""
  );
  const [selectedOutput, setSelectedOutput] = useState(
    () => localStorage.getItem("echoverse_output_device") || ""
  );
  const [showAudioSettings, setShowAudioSettings] = useState(false);
  const [lobbySoundsEnabled, setLobbySoundsEnabled] = useState(
    () => localStorage.getItem("echoverse_lobby_sounds") !== "off"
  );
  const [effectVolume, setEffectVolume] = useState(
    () => Number(localStorage.getItem("echoverse_effect_volume") || "70")
  );

  const [showFriends, setShowFriends] = useState(false);
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendUser[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendUser[]>([]);
  const [friendSearch, setFriendSearch] = useState("");
  const [friendSearchResults, setFriendSearchResults] = useState<FriendUser[]>([]);
  const [activeDmFriend, setActiveDmFriend] = useState<FriendUser | null>(null);
  const [viewMode, setViewMode] = useState<"server" | "dm">("server");
  const [callState, setCallState] = useState<"idle" | "calling" | "ringing" | "connected">("idle");
  const [ringbackPlaying, setRingbackPlaying] = useState(false);
  const [callSeconds, setCallSeconds] = useState(0);
  const [connectionMessage, setConnectionMessage] = useState("");
  const [dmAttachment, setDmAttachment] = useState<{name:string; mime:string; data:string} | null>(null);
  const [dmDragActive, setDmDragActive] = useState(false);
  const [editingDm, setEditingDm] = useState<DmMessage | null>(null);
  const [deafened, setDeafened] = useState(false);
  const [pushToTalk, setPushToTalk] = useState(false);
  const [pttPressed, setPttPressed] = useState(false);



  const [dmMessages, setDmMessages] = useState<DmMessage[]>([]);
  const [dmText, setDmText] = useState("");
  const [unreadDm, setUnreadDm] = useState<Record<string, number>>({});
  const [dmTyping, setDmTyping] = useState<Record<string, boolean>>({});
  const [myStatus, setMyStatus] = useState<"online"|"idle"|"dnd"|"invisible">("online");
  const [dmSearch, setDmSearch] = useState("");
  const [replyTo, setReplyTo] = useState<DmMessage | null>(null);
  const [micTestLevel, setMicTestLevel] = useState(0);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updatePhase, setUpdatePhase] = useState("idle");
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);

  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [privateCallPeer, setPrivateCallPeer] = useState<FriendUser | null>(null);
  const [privateCallSocketId, setPrivateCallSocketId] = useState("");
  const [privateCallId, setPrivateCallId] = useState("");
  const [ringing, setRinging] = useState(false);

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
  const ringAudio = useRef<HTMLAudioElement | null>(null);
  const ringbackAudio = useRef<HTMLAudioElement | null>(null);
  const activeDmFriendRef = useRef<FriendUser | null>(null);
  const accountRef = useRef<Account | null>(null);
  const viewModeRef = useRef<"server" | "dm">("server");
  const dmThreadRef = useRef<HTMLDivElement | null>(null);
  const typingStopTimer = useRef<number | null>(null);
  const callTimer = useRef<number | null>(null);
  const dmFileInputRef = useRef<HTMLInputElement | null>(null);
  const lobbySoundCooldown = useRef(0);
  const activeGuildRef = useRef<Guild | null>(null);
  const joinedRef = useRef(false);
  const lobbySoundsEnabledRef = useRef(lobbySoundsEnabled);
  const effectVolumeRef = useRef(effectVolume);
  const lobbyMembersRef = useRef<PeerInfo[]>([]);
  const lobbyStateReadyRef = useRef(false);
  const reconnectingRef = useRef(false);


  function playLobbyTone(kind: "join" | "leave") {
    if (!lobbySoundsEnabledRef.current) return;
    const now = Date.now();
    if (now - lobbySoundCooldown.current < 180) return;
    lobbySoundCooldown.current = now;

    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new Ctx();
      if (ctx.state === "suspended") void ctx.resume();
      const master = ctx.createGain();
      master.gain.value = Math.max(0, Math.min(1, effectVolumeRef.current / 100)) * 0.32;
      master.connect(ctx.destination);

      const notes = kind === "join" ? [520, 700] : [620, 420];
      notes.forEach((frequency, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = ctx.currentTime + index * 0.075;
        osc.type = "sine";
        osc.frequency.setValueAtTime(frequency, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.7, start + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.095);
        osc.connect(gain);
        gain.connect(master);
        osc.start(start);
        osc.stop(start + 0.11);
      });

      window.setTimeout(() => ctx.close().catch(() => {}), 500);
    } catch (err) {
      console.warn("[EchoVerse] lobby sound failed", err);
    }
  }




  useEffect(() => {
    activeGuildRef.current = activeGuild;
    joinedRef.current = joined;
  }, [activeGuild, joined]);

  useEffect(() => {
    lobbySoundsEnabledRef.current = lobbySoundsEnabled;
  }, [lobbySoundsEnabled]);

  useEffect(() => {
    effectVolumeRef.current = effectVolume;
  }, [effectVolume]);

  useEffect(() => {
    activeDmFriendRef.current = activeDmFriend;
  }, [activeDmFriend]);

  useEffect(() => {
    accountRef.current = account;
  }, [account]);

  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

  useEffect(() => {
    if (!dmThreadRef.current) return;
    dmThreadRef.current.scrollTo({
      top: dmThreadRef.current.scrollHeight,
      behavior: "smooth"
    });
  }, [dmMessages, activeDmFriend?.id]);

  useEffect(() => {
    if (callState === "connected") {
      setCallSeconds(0);
      if (callTimer.current) window.clearInterval(callTimer.current);
      callTimer.current = window.setInterval(() => {
        setCallSeconds(v => v + 1);
      }, 1000);
    } else {
      if (callTimer.current) {
        window.clearInterval(callTimer.current);
        callTimer.current = null;
      }
      setCallSeconds(0);
    }

    return () => {
      if (callTimer.current) {
        window.clearInterval(callTimer.current);
        callTimer.current = null;
      }
    };
  }, [callState]);

  useEffect(() => {
    if (!pushToTalk) return;

    const updateTracks = (enabled: boolean) => {
      localStream.current?.getAudioTracks().forEach(track => {
        track.enabled = enabled && !deafened;
      });
    };

    const down = (event: KeyboardEvent) => {
      if (event.code !== "KeyV" || event.repeat) return;
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT","TEXTAREA"].includes(target.tagName)) return;
      setPttPressed(true);
      updateTracks(true);
    };

    const up = (event: KeyboardEvent) => {
      if (event.code !== "KeyV") return;
      setPttPressed(false);
      updateTracks(false);
    };

    // Push-to-talk: hold V
    updateTracks(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);

    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      if (!muted && !deafened) updateTracks(true);
    };
  }, [pushToTalk, deafened, muted]);

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

    let removeUpdateState: (() => void) | void;

    (async () => {
      try {
        const initial = await window.echoverse?.getUpdateState?.();
        if (initial) {
          setUpdatePhase(initial.phase || "idle");
          setUpdateStatus(initial.status || "");
          setUpdateProgress(initial.percent || 0);
          setUpdateVersion(initial.version || null);
        }
      } catch {}
    })();

    removeUpdateState = window.echoverse?.onUpdateState?.((state: any) => {
      setUpdatePhase(state?.phase || "idle");
      setUpdateStatus(state?.status || "");
      setUpdateProgress(Number(state?.percent || 0));
      setUpdateVersion(state?.version || null);
    });

    // Backward compatibility with older preload builds.
    const removeLegacy = window.echoverse?.onUpdateStatus?.((status: string) => {
      setUpdateStatus(status);
      const progress = status.match(/(\d{1,3})%/);
      if (progress) setUpdateProgress(Number(progress[1]));
    });

    return () => {
      try { removeUpdateState?.(); } catch {}
      try { removeLegacy?.(); } catch {}
    };
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
      setConnectionMessage("");
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
          loadFriends(s);
          refreshAudioDevices();

          const guild = activeGuildRef.current;
          if (joinedRef.current && guild) {
            reconnectingRef.current = true;
            lobbyStateReadyRef.current = false;
            lobbyMembersRef.current = [];
            s.emit("join-room", { guildId: guild.id });
          }
        });
      }
    });

    s.on("disconnect", () => {
      setConnected(false);
      reconnectingRef.current = true;
      lobbyStateReadyRef.current = false;
      setConnectionMessage("Bağlantı kesildi. Yeniden bağlanılıyor…");
    });

    s.on("connect_error", err => {
      setConnected(false);
      setConnectionMessage("EchoVerse sunucusuna yeniden bağlanmaya çalışıyor…");
      setError(`Sunucuya bağlanılamadı: ${err.message}`);
    });

    s.on("guild:list", (list: Guild[]) => setGuilds(list));

    s.on("friends:changed", () => {
      loadFriends(s);
    });
    s.on("presence:changed", ({ accountId, status }: any) => {
      setFriends(prev => prev.map(f => f.id === accountId ? { ...f, status } : f));
    });
    s.on("dm:typing", ({ accountId, typing }: any) => {
      setDmTyping(prev => ({ ...prev, [accountId]: !!typing }));
    });
    s.on("dm:reaction", ({ messageId, reactions }: any) => {
      setDmMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions } : m));
    });

    s.on("dm:updated", (message: DmMessage) => {
      setDmMessages(prev => prev.map(m => m.id === message.id ? { ...m, ...message } : m));
    });

    s.on("dm:deleted", ({ messageId, deletedAt }: any) => {
      setDmMessages(prev => prev.map(m =>
        m.id === messageId
          ? { ...m, body: "", deletedAt, attachmentName: null, attachmentMime: null, attachmentData: null }
          : m
      ));
    });

    s.on("call:missed", () => {
      stopRingtone();
      setIncomingCall(null);
      setCallState("idle");
      window.echoverse?.notify?.({
        title: "Cevapsız EchoVerse araması",
        body: "Bir özel aramayı kaçırdın."
      });
    });

    s.on("friends:request-received", (friend: FriendUser) => {
      loadFriends(s);
      window.echoverse?.notify?.({
        title: "Yeni arkadaşlık isteği",
        body: `${friend.username} seni arkadaş olarak eklemek istiyor.`
      });
    });

    s.on("dm:message", (msg: DmMessage) => {
      const currentFriend = activeDmFriendRef.current;
      const currentAccount = accountRef.current;
      const isOpenConversation =
        viewModeRef.current === "dm" &&
        !!currentFriend &&
        (msg.senderId === currentFriend.id || msg.recipientId === currentFriend.id);

      if (isOpenConversation) {
        setDmMessages(prev => {
          if (prev.some(existing => existing.id === msg.id)) return prev;
          return [...prev, msg];
        });

        if (currentFriend) {
          setUnreadDm(prev => ({ ...prev, [currentFriend.id]: 0 }));
        }
      }

      if (currentAccount && msg.senderId !== currentAccount.id) {
        if (!isOpenConversation) {
          setUnreadDm(prev => ({
            ...prev,
            [msg.senderId]: (prev[msg.senderId] || 0) + 1
          }));

          window.echoverse?.notify?.({
            title: msg.senderUsername || "Yeni mesaj",
            body: msg.body
          });
        }
      }
    });

    s.on("call:incoming", async (call: IncomingCall) => {
      await prepareForPrivateCall();

      const caller =
        friends.find(f => f.id === call.fromAccountId) || {
          id: call.fromAccountId,
          username: call.fromUsername,
          avatarData: call.fromAvatarData
        };

      setActiveDmFriend(caller);
      setViewMode("dm");
      setIncomingCall(call);
      setCallState("ringing");
      startRingtone();

      window.echoverse?.notify?.({
        title: "EchoVerse araması",
        body: `${call.fromUsername} seni arıyor.`
      });
    });

    s.on("call:answered", async (result: any) => {
      setRinging(false);
      stopRingtone();
      stopRingback();

      if (!result.accept) {
        setCallState("idle");
        setPrivateCallPeer(null);
        setPrivateCallSocketId("");
        setPrivateCallId("");
        setError(result?.reason === "timeout" ? "Arama cevaplanmadı." : "Arama reddedildi.");
        return;
      }

      setPrivateCallSocketId(result.responderSocketId);
      setCallState("connected");
      await createPeer(s, result.responderSocketId, true);
    });

    s.on("call:ended", () => {
      stopPrivateCall(false);
    });


    s.on("chat-message", (msg: ChatMessage) => {
      setMessages(prev => [...prev, msg]);
    });

    s.on("presence", (list: PeerInfo[]) => {
      // Fallback for older server builds.
      setPresence(list);
    });

    s.on("voice:lobby-state", async ({ members }: { members: PeerInfo[] }) => {
      const next = Array.isArray(members) ? members : [];
      const previous = lobbyMembersRef.current;
      const previousIds = new Set(previous.map(member => member.socketId));
      const nextIds = new Set(next.map(member => member.socketId));
      const selfId = s.id;

      if (lobbyStateReadyRef.current && !reconnectingRef.current) {
        const joinedSomeone = next.some(
          member => member.socketId !== selfId && !previousIds.has(member.socketId)
        );
        const leftSomeone = previous.some(
          member => member.socketId !== selfId && !nextIds.has(member.socketId)
        );

        if (joinedSomeone) playLobbyTone("join");
        else if (leftSomeone) playLobbyTone("leave");
      }

      lobbyMembersRef.current = next;
      lobbyStateReadyRef.current = true;
      reconnectingRef.current = false;
      setPresence(next);

      // If a point event was missed, repair the WebRTC graph from server truth.
      for (const member of next) {
        if (member.socketId === selfId) continue;
        if (!pcs.current.has(member.socketId)) {
          await createPeer(s, member.socketId, true);
        }
      }

      // Remove ghost peers that are not actually in the lobby anymore.
      for (const peerId of Array.from(pcs.current.keys())) {
        if (peerId !== selfId && !nextIds.has(peerId)) removePeer(peerId);
      }
    });

    s.on("room-peers", async (peers: PeerInfo[]) => {
      for (const peer of peers) {
        await createPeer(s, peer.socketId, true);
      }
    });

    s.on("peer-joined", async (peer: PeerInfo) => {
      await createPeer(s, peer.socketId, false);
      s.emit("voice:sync-request");
    });

    s.on("peer-left", ({ socketId }: { socketId: string }) => {
      removePeer(socketId);
      s.emit("voice:sync-request");
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


  async function refreshAudioDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAudioInputs(devices.filter(d => d.kind === "audioinput"));
      setAudioOutputs(devices.filter(d => d.kind === "audiooutput"));
    } catch {}
  }

  async function switchInput(deviceId: string) {
    setSelectedInput(deviceId);
    localStorage.setItem("echoverse_input_device", deviceId);

    const old = localStream.current;
    const next = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1
      },
      video: false
    });

    const newTrack = next.getAudioTracks()[0];
    newTrack.enabled = !muted;

    for (const pc of pcs.current.values()) {
      const sender = pc.getSenders().find(s => s.track?.kind === "audio");
      if (sender) {
        await sender.replaceTrack(newTrack);
      }
    }

    old?.getAudioTracks().forEach(t => t.stop());
    localStream.current = next;
    startSpeakingMonitor("local", next);
  }

  async function switchOutput(deviceId: string) {
    setSelectedOutput(deviceId);
    localStorage.setItem("echoverse_output_device", deviceId);

    for (const audio of remoteAudio.current.values()) {
      const sinkable = audio as HTMLAudioElement & {
        setSinkId?: (id: string) => Promise<void>;
      };

      if (sinkable.setSinkId) {
        try {
          await sinkable.setSinkId(deviceId);
        } catch {}
      }
    }
  }

  async function loadFriends(s = socket) {
    if (!s) return;

    s.emit("friends:list", {}, (result: any) => {
      if (!result?.ok) return;
      setFriends(result.accepted || []);
      setIncomingRequests(result.incoming || []);
      setOutgoingRequests(result.outgoing || []);
    });
  }

  function searchFriends() {
    if (!socket || !friendSearch.trim()) {
      setFriendSearchResults([]);
      return;
    }

    socket.emit("friends:search", { query: friendSearch }, (result: any) => {
      if (result?.ok) setFriendSearchResults(result.results || []);
    });
  }

  function sendFriendRequest(targetId: string) {
    socket?.emit("friends:request", { targetId }, (result: any) => {
      if (!result?.ok) {
        setError(result?.error || "İstek gönderilemedi.");
        return;
      }
      setFriendSearchResults([]);
      setFriendSearch("");
      loadFriends();
    });
  }

  function respondFriendRequest(friendshipId: string, accept: boolean) {
    socket?.emit(
      "friends:respond",
      { friendshipId, accept },
      (result: any) => {
        if (!result?.ok) {
          setError(result?.error || "İstek işlenemedi.");
          return;
        }
        loadFriends();
      }
    );
  }

  function removeFriend(targetId: string) {
    socket?.emit("friends:remove", { targetId }, () => {
      loadFriends();
      if (activeDmFriend?.id === targetId) {
        setActiveDmFriend(null);
        setDmMessages([]);
      }
    });
  }

  function openDm(friend: FriendUser) {
    if (typingStopTimer.current) {
      window.clearTimeout(typingStopTimer.current);
      typingStopTimer.current = null;
    }

    if (activeDmFriendRef.current) {
      socket?.emit("dm:typing", {
        friendId: activeDmFriendRef.current.id,
        typing: false
      });
    }

    setActiveDmFriend(friend);
    setViewMode("dm");
    setShowFriends(false);
    setDmMessages([]);
    setDmText("");
    setReplyTo(null);
    setUnreadDm(prev => ({ ...prev, [friend.id]: 0 }));

    socket?.emit("dm:history", { friendId: friend.id }, (result: any) => {
      if (result?.ok) setDmMessages(result.messages || []);
    });
  }

  function sendDm() {
    if (!socket || !activeDmFriend) return;

    const body = dmText.trim();

    if (editingDm) {
      if (!body) return;
      socket.emit("dm:edit", { messageId: editingDm.id, body }, (result: any) => {
        if (!result?.ok) setError(result?.error || "Mesaj düzenlenemedi.");
      });
      setEditingDm(null);
      setDmText("");
      return;
    }

    if (!body && !dmAttachment) return;

    const outgoingAttachment = dmAttachment;
    setDmText("");
    setDmAttachment(null);
    setReplyTo(null);
    socket.emit("dm:typing", { friendId: activeDmFriend.id, typing: false });

    socket.emit(
      "dm:send",
      {
        friendId: activeDmFriend.id,
        body,
        replyToId: replyTo?.id || null,
        attachment: outgoingAttachment
      },
      (result: any) => {
        if (!result?.ok) {
          setError(result?.error || "Mesaj gönderilemedi.");
        }
      }
    );
  }

  function editDm(message: DmMessage) {
    if (message.senderId !== account?.id || message.deletedAt) return;
    setEditingDm(message);
    setReplyTo(null);
    setDmAttachment(null);
    setDmText(message.body);
  }

  function deleteDm(message: DmMessage) {
    if (!socket || message.senderId !== account?.id || message.deletedAt) return;
    if (!window.confirm("Bu mesaj silinsin mi?")) return;

    socket.emit("dm:delete", { messageId: message.id }, (result: any) => {
      if (!result?.ok) setError(result?.error || "Mesaj silinemedi.");
    });
  }

  async function chooseDmFile(file: File | null) {
    if (!file) return;

    const MAX = 4 * 1024 * 1024;
    if (file.size > MAX) {
      setError("DM dosyaları en fazla 4 MB olabilir.");
      return;
    }

    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });

      setDmAttachment({
        name: file.name.slice(0, 180),
        mime: file.type || "application/octet-stream",
        data
      });
    } catch {
      setError("Dosya okunamadı.");
    }
  }

  function downloadAttachment(message: DmMessage) {
    if (!message.attachmentData || !message.attachmentName) return;
    const link = document.createElement("a");
    link.href = message.attachmentData;
    link.download = message.attachmentName;
    link.click();
  }

  function toggleDeafen() {
    const next = !deafened;
    setDeafened(next);

    remoteAudio.current.forEach((audio, peerId) => {
      audio.volume = next
        ? 0
        : (peerMuted[peerId] ? 0 : (peerVolumes[peerId] ?? 100) / 100);
    });

    localStream.current?.getAudioTracks().forEach(track => {
      track.enabled = next ? false : (!muted && !pushToTalk);
    });
  }

  async function checkForUpdates() {
    setUpdateStatus("Güncellemeler kontrol ediliyor…");
    const result = await window.echoverse?.checkForUpdates?.();
    if (!result?.ok) setUpdateStatus(result?.error || "Güncelleme kontrolü başarısız.");
  }

  async function installReadyUpdate() {
    const result = await window.echoverse?.installUpdate?.();
    if (!result?.ok) {
      setUpdateStatus(result?.error || "Güncelleme kurulamadı.");
    }
  }

  function updaterBanner() {
    if (!updateStatus) return null;

    return (
      <div className={`global-update-banner ${updatePhase === "error" ? "error" : ""}`}>
        <div className="global-update-copy">
          <b>
            {updatePhase === "error"
              ? "Güncelleme sorunu"
              : updateVersion
                ? `EchoVerse ${updateVersion}`
                : "EchoVerse Update"}
          </b>
          <span>{updateStatus}</span>
          {updatePhase === "downloading" && (
            <progress max="100" value={updateProgress} />
          )}
        </div>

        <div className="global-update-actions">
          {updatePhase === "ready" && (
            <button onClick={installReadyUpdate}>Şimdi yeniden başlat</button>
          )}
          {updatePhase === "error" && (
            <button onClick={checkForUpdates}>Tekrar dene</button>
          )}
        </div>
      </div>
    );
  }

  async function testOutput() {
    try {
      const ctx = new AudioContext(); const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.frequency.value = 523.25; gain.gain.value = 0.06; osc.connect(gain); gain.connect(ctx.destination); osc.start();
      window.setTimeout(() => { try { osc.stop(); ctx.close(); } catch {} }, 500);
    } catch {}
  }

  async function testMicrophone() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio: selectedInput ? {deviceId:{exact:selectedInput}} : true});
      const ctx = new AudioContext(); const analyser=ctx.createAnalyser(); ctx.createMediaStreamSource(stream).connect(analyser);
      const data=new Uint8Array(analyser.fftSize); const start=Date.now();
      const timer=window.setInterval(()=>{ analyser.getByteTimeDomainData(data); let sum=0;
        for(const v of data){const n=(v-128)/128;sum+=n*n;} setMicTestLevel(Math.min(100,Math.round(Math.sqrt(sum/data.length)*420)));
        if(Date.now()-start>4000){clearInterval(timer);stream.getTracks().forEach(t=>t.stop());ctx.close();setMicTestLevel(0);}
      },80);
    } catch { setError("Mikrofon testi başlatılamadı."); }
  }

  function setPresenceStatus(status: "online"|"idle"|"dnd"|"invisible") {
    setMyStatus(status); socket?.emit("presence:set",{status});
  }
  function sendTyping(typing: boolean) {
    const friend = activeDmFriendRef.current;
    if (!friend || !socket) return;

    socket.emit("dm:typing", { friendId: friend.id, typing });

    if (typingStopTimer.current) {
      window.clearTimeout(typingStopTimer.current);
      typingStopTimer.current = null;
    }

    if (typing) {
      typingStopTimer.current = window.setTimeout(() => {
        socket.emit("dm:typing", { friendId: friend.id, typing: false });
        typingStopTimer.current = null;
      }, 1400);
    }
  }
  function reactDm(messageId:string, emoji:string) { socket?.emit("dm:react",{messageId,emoji}); }

  function createToneLoop(frequencies: number[], intervalMs: number, volume = 0.035) {
    try {
      const ctx = new AudioContext();
      let stopped = false;
      let index = 0;

      const play = () => {
        if (stopped) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = frequencies[index % frequencies.length];
        gain.gain.value = volume;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.28);
        index++;
      };

      play();
      const timer = window.setInterval(play, intervalMs);

      return {
        stop: () => {
          stopped = true;
          window.clearInterval(timer);
          try { ctx.close(); } catch {}
        }
      };
    } catch {
      return { stop: () => {} };
    }
  }

  function startRingtone() {
    stopRingtone();
    const loop = createToneLoop([820, 980], 900, 0.045);
    ringAudio.current = { pause: loop.stop } as unknown as HTMLAudioElement;
  }

  function stopRingtone() {
    try { ringAudio.current?.pause(); } catch {}
    ringAudio.current = null;
  }

  function startRingback() {
    stopRingback();
    setRingbackPlaying(true);
    const loop = createToneLoop([440, 480], 1600, 0.028);
    ringbackAudio.current = { pause: loop.stop } as unknown as HTMLAudioElement;
  }

  function stopRingback() {
    try { ringbackAudio.current?.pause(); } catch {}
    ringbackAudio.current = null;
    setRingbackPlaying(false);
  }

  function playCallEndTone() {
    try {
      const ctx = new AudioContext();
      const gain = ctx.createGain();
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(520, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(260, ctx.currentTime + 0.32);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.38);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
      window.setTimeout(() => { try { ctx.close(); } catch {} }, 600);
    } catch {}
  }

  function formatCallTime(total: number) {
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  async function prepareForPrivateCall() {
    // Private call and server voice are mutually exclusive.
    if (joined) {
      await leaveVoice(true);
    }

    pcs.current.forEach(pc => pc.close());
    pcs.current.clear();
    videoSenders.current.clear();

    remoteAudio.current.forEach(audio => {
      try {
        audio.pause();
        audio.srcObject = null;
      } catch {}
    });
    remoteAudio.current.clear();

    stopCameraAndScreen();

    // Keep microphone stream available for the private call, but do not send it
    // anywhere until the private peer connection is created.
    await ensureMicrophone();
  }

  async function callFriend(friend: FriendUser) {
    if (!socket) return;
    if (callState !== "idle" || privateCallPeer || incomingCall) {
      setError("Zaten aktif veya bekleyen bir özel arama var.");
      return;
    }

    await prepareForPrivateCall();

    setPrivateCallPeer(friend);
    setViewMode("dm");
    setCallState("calling");
    setRinging(true);
    startRingback();

    socket.emit("call:start", { friendId: friend.id }, (result: any) => {
      if (!result?.ok) {
        stopRingback();
        setCallState("idle");
        setRinging(false);
        setPrivateCallPeer(null);
        setError(result?.error || "Arama başlatılamadı.");
        return;
      }

      setPrivateCallId(result.callId);
      setPrivateCallSocketId(result.targetSocketId);
    });
  }

  async function answerIncomingCall(accept: boolean) {
    if (!socket || !incomingCall) return;

    stopRingtone();

    socket.emit("call:answer", {
      callId: incomingCall.callId,
      toSocketId: incomingCall.fromSocketId,
      accept
    });

    if (accept) {
      await prepareForPrivateCall();
      setCallState("connected");
      setPrivateCallPeer({
        id: incomingCall.fromAccountId,
        username: incomingCall.fromUsername,
        avatarData: incomingCall.fromAvatarData
      });
      setPrivateCallSocketId(incomingCall.fromSocketId);
      setPrivateCallId(incomingCall.callId);
      await createPeer(socket, incomingCall.fromSocketId, false);
    }

    if (!accept) setCallState("idle");
    setIncomingCall(null);
  }

  function stopPrivateCall(sendEvent = true) {
    if (sendEvent && socket && privateCallSocketId) {
      socket.emit("call:end", {
        toSocketId: privateCallSocketId,
        callId: privateCallId
      });
    }

    if (privateCallSocketId) {
      removePeer(privateCallSocketId);
    }

    setPrivateCallPeer(null);
    setPrivateCallSocketId("");
    setPrivateCallId("");
    setRinging(false);
    setIncomingCall(null);
    setCallState("idle");
    stopRingtone();
    stopRingback();
    playCallEndTone();
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
        deviceId: selectedInput ? { exact: selectedInput } : undefined,
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

        const sinkable = audio as HTMLAudioElement & {
          setSinkId?: (id: string) => Promise<void>;
        };

        if (selectedOutput && sinkable.setSinkId) {
          sinkable.setSinkId(selectedOutput).catch(() => {});
        }

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
      loadFriends(socket);
      refreshAudioDevices();
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

    lobbyStateReadyRef.current = false;
    lobbyMembersRef.current = [];
    reconnectingRef.current = false;

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
    lobbyStateReadyRef.current = false;
    lobbyMembersRef.current = [];
    reconnectingRef.current = false;
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

    stream.getAudioTracks().forEach(track => {
      track.enabled = !next && !deafened && !pushToTalk;
    });

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
        {updaterBanner()}
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

          <div className="v16-qol">
          <button onClick={checkForUpdates}>Güncelleme kontrolü</button>
          {updateProgress > 0 && updateProgress < 100 && <progress max="100" value={updateProgress} />}
          <button onClick={testMicrophone}>Mikrofon testi</button><span>Mic {micTestLevel}%</span>
          <button onClick={testOutput}>Output test sesi</button>
          <select value={myStatus} onChange={e=>setPresenceStatus(e.target.value as any)}>
            <option value="online">Online</option><option value="idle">Idle</option><option value="dnd">DND</option><option value="invisible">Invisible</option>
          </select>
        </div>
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
        {updaterBanner()}
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
      {updaterBanner()}
      {connectionMessage && (
        <div className="connection-status-banner">
          <span className="connection-dot" />
          {connectionMessage}
        </div>
      )}
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


      <main className={`content ${viewMode === "dm" ? "dm-mode" : ""}`}>
        {viewMode === "dm" && activeDmFriend ? (
          <div className="dm-fullpage">
            <header className="dm-page-header">
              <div className="dm-page-user">
                <button className="dm-back" onClick={() => {
                  sendTyping(false);
                  setViewMode("server");
                  setActiveDmFriend(null);
                  setDmText("");
                  setReplyTo(null);
                }}>←</button>

                <div className="avatar">
                  {activeDmFriend.avatarData ? (
                    <img src={activeDmFriend.avatarData} alt="" />
                  ) : (
                    activeDmFriend.username.slice(0, 2).toUpperCase()
                  )}
                </div>

                <div>
                  <b>{activeDmFriend.username}</b>
                  <small>
                    {dmTyping[activeDmFriend.id]
                      ? "yazıyor…"
                      : activeDmFriend.status === "online"
                        ? "Çevrimiçi"
                        : activeDmFriend.status === "idle"
                          ? "Boşta"
                          : activeDmFriend.status === "dnd"
                            ? "Rahatsız Etmeyin"
                            : "Çevrimdışı"}
                  </small>
                </div>
              </div>

              <div className="dm-page-actions">
                <input
                  className="dm-header-search"
                  value={dmSearch}
                  onChange={e => setDmSearch(e.target.value)}
                  placeholder="Mesaj ara"
                />
                <button
                  className="dm-block-button"
                  title="Kullanıcıyı engelle"
                  onClick={() => {
                    if (!socket || !activeDmFriend) return;
                    if (!window.confirm(`${activeDmFriend.username} engellensin mi?`)) return;
                    socket.emit("friends:block", { targetId: activeDmFriend.id }, (result:any) => {
                      if (!result?.ok) return setError(result?.error || "Engellenemedi.");
                      setViewMode("server");
                      setActiveDmFriend(null);
                      loadFriends();
                    });
                  }}
                >🚫</button>
                <button
                  className={callState === "connected" ? "call-connected" : ""}
                  onClick={() => {
                    if (callState === "connected" || callState === "calling") {
                      stopPrivateCall(true);
                    } else {
                      callFriend(activeDmFriend);
                    }
                  }}
                >
                  {callState === "calling"
                    ? "📞 Çalıyor…"
                    : callState === "connected"
                      ? "☎ Aramayı Bitir"
                      : "📞 Ara"}
                </button>
              </div>
            </header>

            {callState !== "idle" && (
              <div className={`private-call-stage ${callState}`}>
                <div className="call-stage-avatar">
                  {activeDmFriend.avatarData ? (
                    <img src={activeDmFriend.avatarData} alt="" />
                  ) : (
                    activeDmFriend.username.slice(0, 2).toUpperCase()
                  )}
                </div>

                <h2>{activeDmFriend.username}</h2>
                <p>
                  {callState === "calling"
                    ? "Aranıyor…"
                    : callState === "connected"
                      ? `Özel konuşma • ${formatCallTime(callSeconds)}`
                      : "Gelen arama"}
                </p>

                {callState === "connected" && (
                  <div className="private-call-controls">
                    <button onClick={toggleMute}>
                      {muted ? "🔇 Mikrofonu Aç" : "🎙️ Mikrofon"}
                    </button>
                    <button onClick={toggleDeafen}>
                      {deafened ? "🔊 Sesi Aç" : "🎧 Deafen"}
                    </button>
                    <button
                      className={pushToTalk ? "active" : ""}
                      onClick={() => setPushToTalk(v => !v)}
                      title="Push-to-talk açıkken konuşmak için V tuşunu basılı tut"
                    >
                      {pushToTalk ? (pttPressed ? "🟢 Konuşuyorsun" : "⌨ V ile Konuş") : "🎙 Voice Activity"}
                    </button>
                    <button className="hangup" onClick={() => stopPrivateCall(true)}>
                      ☎ Kapat
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="dm-thread" ref={dmThreadRef}>
              {dmMessages.length === 0 && (
                <div className="dm-empty">
                  <div className="avatar large">
                    {activeDmFriend.avatarData ? (
                      <img src={activeDmFriend.avatarData} alt="" />
                    ) : (
                      activeDmFriend.username.slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <h2>{activeDmFriend.username}</h2>
                  <p>Bu, {activeDmFriend.username} ile olan sohbetinin başlangıcı.</p>
                </div>
              )}

              {dmMessages
                .filter(m => {
                  const query = dmSearch.trim().toLowerCase();
                  if (!query) return true;
                  return (
                    m.body?.toLowerCase().includes(query) ||
                    m.attachmentName?.toLowerCase().includes(query)
                  );
                })
                .map((m, index, filtered) => {
                  const mine = m.senderId === account?.id;
                  const previous = index > 0 ? filtered[index - 1] : null;
                  const currentDate = new Date(m.createdAt);
                  const previousDate = previous ? new Date(previous.createdAt) : null;
                  const showDate =
                    !previousDate ||
                    previousDate.toDateString() !== currentDate.toDateString();

                  const replied = m.replyToId
                    ? dmMessages.find(candidate => candidate.id === m.replyToId)
                    : null;

                  return (
                    <React.Fragment key={m.id}>
                      {showDate && (
                        <div className="dm-date-divider">
                          <span>
                            {currentDate.toDateString() === new Date().toDateString()
                              ? "Bugün"
                              : currentDate.toLocaleDateString()}
                          </span>
                        </div>
                      )}

                      <div className={`dm-discord-message ${mine ? "mine" : ""} ${m.deletedAt ? "deleted" : ""}`}>
                        <div className="avatar">
                          {mine && account?.avatarData ? (
                            <img src={account.avatarData} alt="" />
                          ) : !mine && activeDmFriend.avatarData ? (
                            <img src={activeDmFriend.avatarData} alt="" />
                          ) : (
                            (mine ? username : activeDmFriend.username).slice(0,2).toUpperCase()
                          )}
                        </div>

                        <div className="dm-discord-body">
                          <div className="dm-discord-meta">
                            <b>{mine ? username : activeDmFriend.username}</b>
                            <small>{currentDate.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</small>
                            {m.editedAt && !m.deletedAt && <small>(düzenlendi)</small>}
                          </div>

                          {replied && (
                            <div className="dm-reply-preview">
                              ↪ {replied.deletedAt ? "Silinmiş mesaj" : replied.body || replied.attachmentName || "Mesaj"}
                            </div>
                          )}

                          {m.deletedAt ? (
                            <div className="dm-deleted-text">Mesaj silindi.</div>
                          ) : (
                            <>
                              {m.body && <div className="dm-discord-text">{m.body}</div>}

                              {m.attachmentData && m.attachmentName && (
                                <div className="dm-attachment">
                                  {m.attachmentMime?.startsWith("image/") ? (
                                    <img
                                      src={m.attachmentData}
                                      alt={m.attachmentName}
                                      onClick={() => window.open(m.attachmentData || "", "_blank")}
                                    />
                                  ) : (
                                    <div className="dm-file-icon">📎</div>
                                  )}
                                  <div>
                                    <b>{m.attachmentName}</b>
                                    <button onClick={() => downloadAttachment(m)}>İndir</button>
                                  </div>
                                </div>
                              )}

                              <div className="dm-reactions">
                                {Object.entries(m.reactions || {}).map(([emoji, ids]) => (
                                  <button
                                    key={emoji}
                                    className={ids.includes(account?.id || "") ? "mine" : ""}
                                    onClick={() => reactDm(m.id, emoji)}
                                  >
                                    {emoji} {ids.length}
                                  </button>
                                ))}
                              </div>
                            </>
                          )}

                          {!m.deletedAt && (
                            <div className="dm-message-actions">
                              <button onClick={() => setReplyTo(m)}>↩ Yanıtla</button>
                              {["👍","❤️","😂","🔥"].map(emoji => (
                                <button key={emoji} onClick={() => reactDm(m.id, emoji)}>{emoji}</button>
                              ))}
                              {mine && <button onClick={() => editDm(m)}>✏ Düzenle</button>}
                              {mine && <button className="danger" onClick={() => deleteDm(m)}>🗑 Sil</button>}
                            </div>
                          )}
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
            </div>

            <div className="dm-composer-zone">
              {(replyTo || editingDm || dmAttachment) && (
                <div className="dm-compose-context">
                  {editingDm && (
                    <span>✏ Mesaj düzenleniyor</span>
                  )}
                  {replyTo && !editingDm && (
                    <span>↩ {replyTo.senderId === account?.id ? "Kendine" : activeDmFriend.username} yanıtlanıyor</span>
                  )}
                  {dmAttachment && (
                    <span>📎 {dmAttachment.name} · gönderime hazır</span>
                  )}
                  <button onClick={() => {
                    setReplyTo(null);
                    setEditingDm(null);
                    setDmAttachment(null);
                    if (editingDm) setDmText("");
                  }}>✕</button>
                </div>
              )}

              <div
                className={`dm-page-composer ${dmDragActive ? "drag-active" : ""}`}
                onDragEnter={e => { e.preventDefault(); setDmDragActive(true); }}
                onDragOver={e => { e.preventDefault(); setDmDragActive(true); }}
                onDragLeave={e => { e.preventDefault(); setDmDragActive(false); }}
                onDrop={e => {
                  e.preventDefault();
                  setDmDragActive(false);
                  chooseDmFile(e.dataTransfer.files?.[0] || null);
                }}
              >
                {dmDragActive && <div className="dm-drop-hint">Dosyayı bırak</div>}
                <input
                  ref={dmFileInputRef}
                  type="file"
                  className="hidden-file-input"
                  onChange={e => {
                    chooseDmFile(e.target.files?.[0] || null);
                    e.currentTarget.value = "";
                  }}
                />

                <button
                  className="dm-attach-button"
                  title="Dosya gönder (maks. 4 MB)"
                  onClick={() => dmFileInputRef.current?.click()}
                >
                  ＋
                </button>

                <input
                  value={dmText}
                  onFocus={() => sendTyping(true)}
                  onBlur={() => sendTyping(false)}
                  onChange={e => {
                    setDmText(e.target.value);
                    sendTyping(true);
                  }}
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendDm();
                    }
                  }}
                  placeholder={
                    editingDm
                      ? "Mesajı düzenle"
                      : `${activeDmFriend.username} kişisine mesaj gönder`
                  }
                />
                <button onClick={sendDm}>
                  {editingDm ? "Kaydet" : "Gönder"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>

        <header className="topbar">
          <div>
            <b># general</b>
            <span>
              {activeGuild?.name}
            </span>
          </div>

          <div className="top-actions">
            <button onClick={() => {
              refreshAudioDevices();
              setShowAudioSettings(true);
            }}>
              ⚙ Ses
            </button>

            <button onClick={() => {
              loadFriends();
              setShowFriends(true);
            }}>
              👥 Arkadaşlar
              {incomingRequests.length > 0 ? ` (${incomingRequests.length})` : ""}
            </button>

            <select
              className="presence-select"
              value={myStatus}
              onChange={e => setPresenceStatus(e.target.value as any)}
              title="Durum"
            >
              <option value="online">🟢 Çevrimiçi</option>
              <option value="idle">🌙 Boşta</option>
              <option value="dnd">⛔ Rahatsız Etmeyin</option>
              <option value="invisible">⚫ Görünmez</option>
            </select>

            <div className="top-state">
              ✨ Noise suppression
            </div>
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
          </>
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



      {showAudioSettings && (
        <div className="modal-backdrop">
          <div className="modal audio-settings-modal">
            <h2>Ses Ayarları</h2>

            <label>Mikrofon / Input</label>
            <select
              value={selectedInput}
              onChange={e => switchInput(e.target.value)}
            >
              <option value="">Sistem varsayılanı</option>
              {audioInputs.map(d => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Mikrofon ${d.deviceId.slice(0, 6)}`}
                </option>
              ))}
            </select>

            <label>Hoparlör / Output</label>
            <select
              value={selectedOutput}
              onChange={e => switchOutput(e.target.value)}
            >
              <option value="">Sistem varsayılanı</option>
              {audioOutputs.map(d => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Hoparlör ${d.deviceId.slice(0, 6)}`}
                </option>
              ))}
            </select>

            <div className="sound-settings-block">
              <label className="sound-toggle-row">
                <span>
                  <b>Lobi giriş / çıkış sesleri</b>
                  <small>Bulunduğun ses lobisine biri katıldığında veya ayrıldığında çalar.</small>
                </span>
                <input
                  type="checkbox"
                  checked={lobbySoundsEnabled}
                  onChange={e => {
                    const enabled = e.target.checked;
                    setLobbySoundsEnabled(enabled);
                    localStorage.setItem("echoverse_lobby_sounds", enabled ? "on" : "off");
                  }}
                />
              </label>

              <label>Efekt ses seviyesi · %{effectVolume}</label>
              <input
                type="range"
                min="0"
                max="100"
                value={effectVolume}
                onChange={e => {
                  const value = Number(e.target.value);
                  setEffectVolume(value);
                  localStorage.setItem("echoverse_effect_volume", String(value));
                }}
              />
            </div>

            <div className="modal-actions">
              <button onClick={() => setShowAudioSettings(false)}>Kapat</button>
            </div>
          </div>
        </div>
      )}

      {showFriends && (
        <div className="modal-backdrop">
          <div className="modal friends-modal">
            <div className="friends-header">
              <h2>Arkadaşlar</h2>
              <button onClick={() => setShowFriends(false)}>✕</button>
            </div>

            <div className="friend-search-row">
              <input
                value={friendSearch}
                onChange={e => setFriendSearch(e.target.value)}
                onKeyDown={e => e.key === "Enter" && searchFriends()}
                placeholder="Kullanıcı adı ara"
              />
              <button onClick={searchFriends}>Ara</button>
            </div>

            {friendSearchResults.length > 0 && (
              <div className="friend-section">
                <h3>Arama sonucu</h3>
                {friendSearchResults.map(f => (
                  <div className="friend-row" key={f.id}>
                    <div className="friend-user">
                      <div className="avatar">
                        {f.avatarData ? <img src={f.avatarData} alt="" /> : f.username.slice(0,2).toUpperCase()}
                      </div>
                      <b>{f.username}</b>
                    </div>
                    <button onClick={() => sendFriendRequest(f.id)}>＋ Ekle</button>
                  </div>
                ))}
              </div>
            )}

            {incomingRequests.length > 0 && (
              <div className="friend-section">
                <h3>Gelen istekler</h3>
                {incomingRequests.map(f => (
                  <div className="friend-row" key={f.id}>
                    <div className="friend-user">
                      <div className="avatar">
                        {f.avatarData ? <img src={f.avatarData} alt="" /> : f.username.slice(0,2).toUpperCase()}
                      </div>
                      <b>{f.username}</b>
                    </div>
                    <div className="friend-actions">
                      <button onClick={() => respondFriendRequest(f.friendshipId!, true)}>✓</button>
                      <button onClick={() => respondFriendRequest(f.friendshipId!, false)}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="friend-section">
              <h3>Arkadaşlarım</h3>
              {friends.length === 0 && <small>Henüz arkadaşın yok.</small>}

              {friends.map(f => (
                <div className="friend-row" key={f.id}>
                  <div className="friend-user">
                    <div className="avatar">
                      {f.avatarData ? <img src={f.avatarData} alt="" /> : f.username.slice(0,2).toUpperCase()}
                    </div>
                    <b>{f.username}</b>
                  </div>

                  <div className="friend-actions">
                    <button className="dm-open-button" onClick={() => openDm(f)}>
                      💬
                      {(unreadDm[f.id] || 0) > 0 && (
                        <span className="dm-unread-badge">{Math.min(unreadDm[f.id], 99)}</span>
                      )}
                    </button>
                    <button onClick={() => callFriend(f)}>📞</button>
                    <button onClick={() => removeFriend(f.id)}>🗑</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {incomingCall && (
        <div className="incoming-call">
          <div className="call-avatar">
            {incomingCall.fromAvatarData ? (
              <img src={incomingCall.fromAvatarData} alt="" />
            ) : (
              incomingCall.fromUsername.slice(0,2).toUpperCase()
            )}
          </div>
          <div className="call-info">
            <b>{incomingCall.fromUsername}</b>
            <span>Özel arama geliyor…</span>
          </div>
          <button className="answer-call" onClick={() => answerIncomingCall(true)}>📞</button>
          <button className="reject-call" onClick={() => answerIncomingCall(false)}>✕</button>
        </div>
      )}

      {privateCallPeer && (
        <div className="private-call-bar">
          <span>
            📞 {privateCallPeer.username}
            {ringing
              ? " aranıyor…"
              : ` ile özel konuşma • ${formatCallTime(callSeconds)}`}
          </span>
          <button onClick={() => stopPrivateCall(true)}>Aramayı Bitir</button>
        </div>
      )}

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
