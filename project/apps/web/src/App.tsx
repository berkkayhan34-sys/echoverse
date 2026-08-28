import React, { useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { createTranslator, formatLocaleDate } from "@echoverse/contracts";
import {
  appendChatMessage,
  appendDmMessage,
  applyDmReaction,
  clearStoredUsername,
  createAuthRequest,
  createScreenVideoConstraints,
  createSocketAuth,
  deleteDmMessage,
  getLobbyMemberTransition,
  incrementDmUnread,
  markDmRead,
  readClientLocale,
  readStoredUsername,
  resolveClientLocale,
  isLocalAudioEnabled,
  formatCallTime,
  REALTIME_RETRY_POLICY,
  updateDmMessage,
  updateFriendPresence,
  updateTypingState,
  writeClientLocale,
  writeStoredUsername
} from "@echoverse/client-core";
import {
  AuthForm,
  DirectMessageView,
  GuildPicker,
  LocaleSelect,
  ServerView,
  WorkspaceOverlays,
  WorkspaceSidebar
} from "@echoverse/shared-ui";
import { createAudioDevicesFeature } from "./features/audio-devices";
import { createDirectMessagesFeature } from "./features/direct-messages";
import { createFriendsFeature } from "./features/friends";
import type {
  Account,
  ChatMessage,
  DmMessage,
  FriendUser,
  Guild,
  IncomingCall,
  PeerInfo,
  ScreenSource,
  SpotifyState,
  Locale
} from "@echoverse/contracts";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" }
];

export default function App() {
  const [serverUrl, setServerUrl] = useState("");
  const [locale, setLocale] = useState<Locale>(() =>
    readClientLocale(localStorage, navigator.language)
  );
  const t = useMemo(() => createTranslator(locale), [locale]);
  const translatorRef = useRef(t);
  const [spotifyConfigured, setSpotifyConfigured] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const refreshingSessionRef = useRef(false);
  const [username, setUsername] = useState(() => readStoredUsername(localStorage));
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
  const [appVersion, setAppVersion] = useState("unknown");
  const [screenSources, setScreenSources] = useState<ScreenSource[]>([]);
  const [showScreenPicker, setShowScreenPicker] = useState(false);
  const [screenPermission, setScreenPermission] = useState("");

  const [peerVolumes, setPeerVolumes] = useState<Record<string, number>>({});
  const [peerMuted, setPeerMuted] = useState<Record<string, boolean>>({});
  const [speakingPeers, setSpeakingPeers] = useState<Record<string, boolean>>({});
  const [localSpeaking, setLocalSpeaking] = useState(false);

  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState(
    () => localStorage.getItem("echoverse_camera_device") || ""
  );
  const [screenQuality, setScreenQuality] = useState<"720" | "1080">(() =>
    localStorage.getItem("echoverse_screen_quality") === "1080" ? "1080" : "720"
  );
  const [screenFps, setScreenFps] = useState<30 | 60>(() =>
    localStorage.getItem("echoverse_screen_fps") === "60" ? 60 : 30
  );
  const [videoLayout, setVideoLayout] = useState<"grid" | "focus">("grid");
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
  const [effectVolume, setEffectVolume] = useState(() =>
    Number(localStorage.getItem("echoverse_effect_volume") || "70")
  );

  const [showFriends, setShowFriends] = useState(false);
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendUser[]>([]);
  const [, setOutgoingRequests] = useState<FriendUser[]>([]);
  const [friendSearch, setFriendSearch] = useState("");
  const [friendSearchResults, setFriendSearchResults] = useState<FriendUser[]>([]);
  const [activeDmFriend, setActiveDmFriend] = useState<FriendUser | null>(null);
  const [viewMode, setViewMode] = useState<"server" | "dm">("server");
  const [callState, setCallState] = useState<"idle" | "calling" | "ringing" | "connected">("idle");
  const [, setRingbackPlaying] = useState(false);
  const [callSeconds, setCallSeconds] = useState(0);
  const [connectionMessage, setConnectionMessage] = useState("");
  const [dmAttachment, setDmAttachment] = useState<{
    name: string;
    mime: string;
    data: string;
  } | null>(null);
  const [dmDragActive, setDmDragActive] = useState(false);
  const [editingDm, setEditingDm] = useState<DmMessage | null>(null);
  const [deafened, setDeafened] = useState(false);
  const [pushToTalk, setPushToTalk] = useState(false);
  const [pttPressed, setPttPressed] = useState(false);

  const [dmMessages, setDmMessages] = useState<DmMessage[]>([]);
  const [dmText, setDmText] = useState("");
  const [unreadDm, setUnreadDm] = useState<Record<string, number>>({});
  const [dmTyping, setDmTyping] = useState<Record<string, boolean>>({});
  const [myStatus, setMyStatus] = useState<"online" | "idle" | "dnd" | "invisible">("online");
  const [dmSearch, setDmSearch] = useState("");
  const [replyTo, setReplyTo] = useState<DmMessage | null>(null);
  const [micTestLevel, setMicTestLevel] = useState(0);
  const [updateProgress, setUpdateProgress] = useState(0);
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

  useEffect(() => {
    translatorRef.current = t;
  }, [t]);

  useEffect(() => {
    document.documentElement.lang = locale;
    writeClientLocale(localStorage, locale);
  }, [locale]);

  useEffect(() => {
    document.title = t("app.webTitle");
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", t("app.description"));
  }, [t]);

  function changeLocale(nextLocale: string) {
    setLocale(resolveClientLocale(nextLocale));
  }

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

  const friendsFeature = createFriendsFeature({
    getSocket: () => socket,
    getSearch: () => friendSearch,
    getActiveFriend: () => activeDmFriendRef.current,
    getTypingTimer: () => typingStopTimer.current,
    setTypingTimer: (timer) => {
      typingStopTimer.current = timer;
    },
    setError,
    setFriends,
    setIncomingRequests,
    setOutgoingRequests,
    setFriendSearch,
    setFriendSearchResults,
    setActiveFriend: setActiveDmFriend,
    setViewMode,
    setShowFriends,
    setDmMessages,
    setDmText,
    setReplyTo,
    setUnreadDm,
    translate: (key) => t(key as Parameters<typeof t>[0]),
    markDmRead
  });
  const {
    loadFriends,
    searchFriends,
    sendFriendRequest,
    respondFriendRequest,
    removeFriend,
    openDm
  } = friendsFeature;

  const directMessagesFeature = createDirectMessagesFeature({
    getSocket: () => socket,
    getFriend: () => activeDmFriendRef.current,
    getAccount: () => accountRef.current,
    getText: () => dmText,
    getEditing: () => editingDm,
    getAttachment: () => dmAttachment,
    getReply: () => replyTo,
    getTypingTimer: () => typingStopTimer.current,
    setTypingTimer: (timer) => {
      typingStopTimer.current = timer;
    },
    setText: setDmText,
    setAttachment: setDmAttachment,
    setReply: setReplyTo,
    setEditing: setEditingDm,
    setError,
    translate: (key) => t(key as Parameters<typeof t>[0]),
    confirmDelete: (message) => window.confirm(message)
  });
  const { sendDm, editDm, deleteDm, sendTyping, reactDm } = directMessagesFeature;

  const audioDevicesFeature = createAudioDevicesFeature({
    localStream,
    peerConnections: pcs,
    remoteAudio,
    getMuted: () => muted,
    setSelectedInput,
    setSelectedOutput,
    setAudioInputs,
    setAudioOutputs,
    setVideoInputs,
    startSpeakingMonitor
  });
  const { refreshAudioDevices, switchInput, switchOutput } = audioDevicesFeature;

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
      console.warn("[echoverse.lobby_sound_failed]", err);
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
        setCallSeconds((v) => v + 1);
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
      localStream.current?.getAudioTracks().forEach((track) => {
        track.enabled = enabled && !deafened;
      });
    };

    const down = (event: KeyboardEvent) => {
      if (event.code !== "KeyV" || event.repeat) return;
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;
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
            serverUrl:
              window.location.hostname === "127.0.0.1"
                ? "http://127.0.0.1:3001"
                : "http://localhost:3001",
            spotifyClientId: ""
          };

      setServerUrl(cfg.serverUrl);
      setSpotifyConfigured(
        !!cfg.spotifyClientId && !cfg.spotifyClientId.startsWith("SPOTIFY_CLIENT_ID")
      );

      await refreshSpotifyStatus();

      try {
        const version = await window.echoverse?.getVersion?.();
        if (version) setAppVersion(version);
      } catch {}
    })();

    window.echoverse?.onUpdateStatus?.((status: string) => {
      setUpdateStatus(status);
      const progress = status.match(/(\d{1,3})%/);
      if (progress) setUpdateProgress(Number(progress[1]));
    });
  }, []);

  useEffect(() => {
    if (!serverUrl) return;

    const s = io(serverUrl, {
      transports: ["websocket", "polling"],
      ...REALTIME_RETRY_POLICY,
      withCredentials: true,
      auth: createSocketAuth(locale, "web")
    });

    setSocket(s);

    const refreshWebSession = async () => {
      if (refreshingSessionRef.current) return;
      refreshingSessionRef.current = true;
      try {
        const response = await fetch(`${serverUrl}/auth/refresh`, {
          method: "POST",
          credentials: "include",
          headers: { "X-EchoVerse-Locale": locale }
        });
        if (!response.ok) {
          setAccount(null);
          setIdentified(false);
          return;
        }
        s.connect();
      } catch {
        setAccount(null);
        setIdentified(false);
      } finally {
        refreshingSessionRef.current = false;
      }
    };

    s.on("connect", () => {
      setConnected(true);
      setConnectionMessage("");
      setError("");
    });

    s.on("auth:session", (result: any) => {
      if (!result?.ok || !result.account) return;
      writeStoredUsername(localStorage, result.account.username);
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

    s.on("auth:expired", () => {
      void refreshWebSession();
    });

    s.on("disconnect", () => {
      setConnected(false);
      reconnectingRef.current = true;
      lobbyStateReadyRef.current = false;
      setConnectionMessage(translatorRef.current("connection.lost"));
    });

    s.on("connect_error", (err) => {
      setConnected(false);
      setConnectionMessage(translatorRef.current("connection.retrying"));
      setError(translatorRef.current("error.connectionFailed"));
      if (/invalid session|session expired/i.test(err.message)) void refreshWebSession();
    });

    s.io.on("reconnect_failed", () => {
      setConnected(false);
      setConnectionMessage(translatorRef.current("connection.offline"));
      setError(translatorRef.current("error.connectionFailed"));
      stopAllMedia();
    });

    s.on("guild:list", (list: Guild[]) => setGuilds(list));

    s.on("friends:changed", () => {
      loadFriends(s);
    });
    s.on("presence:changed", ({ accountId, status }: any) => {
      setFriends((prev) => updateFriendPresence(prev, accountId, status));
    });
    s.on("dm:typing", ({ accountId, typing }: any) => {
      setDmTyping((prev) => updateTypingState(prev, accountId, !!typing));
    });
    s.on("dm:reaction", ({ messageId, reactions }: any) => {
      setDmMessages((prev) => applyDmReaction(prev, messageId, reactions));
    });

    s.on("dm:updated", (message: DmMessage) => {
      setDmMessages((prev) => updateDmMessage(prev, message));
    });

    s.on("dm:deleted", ({ messageId, deletedAt }: any) => {
      setDmMessages((prev) => deleteDmMessage(prev, messageId, deletedAt));
    });

    s.on("call:missed", () => {
      stopRingtone();
      setIncomingCall(null);
      setCallState("idle");
      window.echoverse?.notify?.({
        title: translatorRef.current("notification.callMissedTitle"),
        body: translatorRef.current("notification.callMissedBody")
      });
    });

    s.on("friends:request-received", (friend: FriendUser) => {
      loadFriends(s);
      window.echoverse?.notify?.({
        title: translatorRef.current("notification.friendRequestTitle"),
        body: translatorRef.current("notification.friendRequestBody", {
          username: friend.username
        })
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
        setDmMessages((prev) => appendDmMessage(prev, msg));

        if (currentFriend) {
          setUnreadDm((prev) => markDmRead(prev, currentFriend.id));
        }
      }

      if (currentAccount && msg.senderId !== currentAccount.id) {
        if (!isOpenConversation) {
          setUnreadDm((prev) => incrementDmUnread(prev, msg.senderId));

          window.echoverse?.notify?.({
            title: msg.senderUsername || translatorRef.current("notification.newMessageTitle"),
            body: msg.body
          });
        }
      }
    });

    s.on("call:incoming", async (call: IncomingCall) => {
      await prepareForPrivateCall();

      const caller = friends.find((f) => f.id === call.fromAccountId) || {
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
        title: translatorRef.current("notification.callTitle"),
        body: translatorRef.current("notification.callBody", { username: call.fromUsername })
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
        setError(
          result?.reason === "timeout"
            ? translatorRef.current("call.timeout")
            : translatorRef.current("call.rejected")
        );
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
      setMessages((prev) => appendChatMessage(prev, msg));
    });

    s.on("presence", (list: PeerInfo[]) => {
      // Fallback for older server builds.
      setPresence(list);
    });

    s.on("voice:lobby-state", async ({ members }: { members: PeerInfo[] }) => {
      const next = Array.isArray(members) ? members : [];
      const previous = lobbyMembersRef.current;
      const selfId = s.id;
      const transition = getLobbyMemberTransition(previous, next, selfId, reconnectingRef.current);

      if (lobbyStateReadyRef.current) {
        if (transition.joinedSomeone) playLobbyTone("join");
        else if (transition.leftSomeone) playLobbyTone("leave");
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
      const nextIds = new Set(transition.memberSocketIds);
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
      setSpotifyMessage(translatorRef.current("spotify.ended"));
    });

    s.on("spotify:sync", async (state: SpotifyState) => {
      setSpotifyParty(state);

      if (!spotifyFollowing || state.leaderSocketId === s.id) return;

      try {
        await window.echoverse?.spotifyApplySync?.(state);
        setSpotifyMessage(
          state.trackName
            ? `🎵 ${state.trackName} • ${state.artistName || ""}`
            : translatorRef.current("spotify.synchronized")
        );
      } catch (err: any) {
        setSpotifyMessage(err?.message || translatorRef.current("spotify.syncFailed"));
      }
    });

    return () => {
      s.disconnect();
      stopSpotifyLeaderTimer();
      stopAllMedia();
    };
  }, [locale, serverUrl, spotifyFollowing]);

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
          .forEach((el) => el.classList.remove("video-maximized"));
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
      setSpeakingPeers((prev) => {
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
      const source = ctx.createMediaStreamSource(new MediaStream([audioTrack]));
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
          setSpeakingPeers((prev) => ({
            ...prev,
            [peerId]: speaking
          }));
        }
      }, 90);

      speakingIntervals.current.set(peerId, interval);
    } catch (err) {
      console.warn("[echoverse.speaking_monitor_error]", err);
    }
  }

  async function chooseDmFile(file: File | null) {
    if (!file) return;

    const MAX = 4 * 1024 * 1024;
    if (file.size > MAX) {
      setError(t("chat.fileTooLarge"));
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
      setError(t("chat.fileReadFailed"));
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
      audio.volume = next ? 0 : peerMuted[peerId] ? 0 : (peerVolumes[peerId] ?? 100) / 100;
    });

    localStream.current?.getAudioTracks().forEach((track) => {
      track.enabled = isLocalAudioEnabled(muted, next, pushToTalk, false);
    });
  }

  async function checkForUpdates() {
    setUpdateStatus(t("update.checking"));
    const result = await window.echoverse?.checkForUpdates?.();
    if (!result?.ok) setUpdateStatus(result?.error || t("update.failed"));
  }

  async function testOutput() {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 523.25;
      gain.gain.value = 0.06;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      window.setTimeout(() => {
        try {
          osc.stop();
          ctx.close();
        } catch {}
      }, 500);
    } catch {}
  }

  async function testMicrophone() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: selectedInput ? { deviceId: { exact: selectedInput } } : true
      });
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      const start = Date.now();
      const timer = window.setInterval(() => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const v of data) {
          const n = (v - 128) / 128;
          sum += n * n;
        }
        setMicTestLevel(Math.min(100, Math.round(Math.sqrt(sum / data.length) * 420)));
        if (Date.now() - start > 4000) {
          clearInterval(timer);
          stream.getTracks().forEach((t) => t.stop());
          ctx.close();
          setMicTestLevel(0);
        }
      }, 80);
    } catch {
      setError(t("media.micTestFailed"));
    }
  }

  function setPresenceStatus(status: "online" | "idle" | "dnd" | "invisible") {
    setMyStatus(status);
    socket?.emit("presence:set", { status });
  }
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
          try {
            ctx.close();
          } catch {}
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
    try {
      ringAudio.current?.pause();
    } catch {}
    ringAudio.current = null;
  }

  function startRingback() {
    stopRingback();
    setRingbackPlaying(true);
    const loop = createToneLoop([440, 480], 1600, 0.028);
    ringbackAudio.current = { pause: loop.stop } as unknown as HTMLAudioElement;
  }

  function stopRingback() {
    try {
      ringbackAudio.current?.pause();
    } catch {}
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
      window.setTimeout(() => {
        try {
          ctx.close();
        } catch {}
      }, 600);
    } catch {}
  }

  async function prepareForPrivateCall() {
    // Private call and server voice are mutually exclusive.
    if (joined) {
      await leaveVoice(true);
    }

    pcs.current.forEach((pc) => pc.close());
    pcs.current.clear();
    videoSenders.current.clear();

    remoteAudio.current.forEach((audio) => {
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
      setError(t("call.alreadyActive"));
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
        setError(result?.error || t("call.startFailed"));
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
      setSpotifyMessage(t("spotify.opening"));
      await window.echoverse?.spotifyLogin?.();
      await refreshSpotifyStatus();
      setSpotifyMessage(t("spotify.connected"));
    } catch {
      setSpotifyMessage(t("spotify.loginFailed"));
    }
  }

  async function spotifyLogout() {
    await window.echoverse?.spotifyLogout?.();
    setSpotifyConnected(false);
    setSpotifyName("");
    setSpotifyFollowing(false);
    setSpotifyLeader(false);
    stopSpotifyLeaderTimer();
    setSpotifyMessage(t("spotify.disconnected"));
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
        setSpotifyMessage(t("spotify.openTrackFirst"));
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
      setSpotifyMessage(err?.message || t("spotify.syncFailed"));
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
    setSpotifyMessage(t("spotify.stopped"));
  }

  async function followSpotifyParty() {
    if (!spotifyConnected) {
      setSpotifyMessage(t("spotify.connectFirst"));
      return;
    }

    setSpotifyFollowing(true);

    if (spotifyParty?.trackUri) {
      try {
        await window.echoverse?.spotifyApplySync?.(spotifyParty);
        setSpotifyMessage(t("spotify.following", { track: spotifyParty.trackName || "Spotify" }));
      } catch {
        setSpotifyMessage(t("spotify.openTrackFirst"));
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

  async function createPeer(s: Socket, peerId: string, initiator: boolean) {
    const existing = pcs.current.get(peerId);
    if (existing) return existing;

    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS
    });

    pcs.current.set(peerId, pc);

    const stream = await ensureMicrophone();

    stream.getAudioTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    const videoTransceiver = pc.addTransceiver("video", {
      direction: "sendrecv"
    });

    videoSenders.current.set(peerId, videoTransceiver.sender);

    if (outgoingVideoTrack.current) {
      await videoTransceiver.sender.replaceTrack(outgoingVideoTrack.current);
    }

    pc.onicecandidate = (evt) => {
      if (evt.candidate) {
        s.emit("webrtc-ice", {
          to: peerId,
          candidate: evt.candidate
        });
      }
    };

    pc.ontrack = (evt) => {
      const streamForTrack = evt.streams[0] || new MediaStream([evt.track]);

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
        audio.volume = peerMuted[peerId] ? 0 : volume / 100;

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

    remoteVideoHost.current?.querySelector(`[data-peer="${peerId}"]`)?.remove();
  }

  function attachRemoteVideo(peerId: string, track: MediaStreamTrack) {
    const host = remoteVideoHost.current;
    if (!host) return;

    let video = host.querySelector<HTMLVideoElement>(`video[data-peer="${peerId}"]`);

    if (!video) {
      video = document.createElement("video");
      video.dataset.peer = peerId;
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true;
      video.className = "remote-video";
      video.title = t("ui.videoExpandTitle");
      const badge = document.createElement("span");
      badge.className = "video-live-badge";
      badge.textContent = translatorRef.current("status.live");
      video.parentElement?.appendChild(badge);
      video.onclick = () => {
        document.querySelectorAll(".video-maximized").forEach((el) => {
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
    if (!serverUrl || authBusy) return;

    const email = authEmail.trim();
    const password = authPassword;

    if (!email || !password) {
      setError(t("auth.invalid"));
      return;
    }

    if (authMode === "register" && authUsername.trim().length < 3) {
      setError(t("auth.invalid"));
      return;
    }

    setAuthBusy(true);
    setError("");

    const authRequest = createAuthRequest(authMode, email, password, authUsername.trim());

    try {
      const response = await fetch(`${serverUrl}/auth/${authRequest.endpoint}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-EchoVerse-Client": "web",
          "X-EchoVerse-Locale": locale
        },
        body: JSON.stringify(authRequest.payload)
      });
      const result = await response.json();
      setAuthBusy(false);

      if (!response.ok || !result?.ok) {
        setError(result?.error || t("error.operationFailed"));
        return;
      }

      writeStoredUsername(localStorage, result.account.username);

      setAccount(result.account);
      setUsername(result.account.username);
      setIdentified(true);
      socket?.disconnect();
      socket?.connect();
      setAuthPassword("");
      setError("");

      try {
        await ensureMicrophone();
      } catch (err: any) {
        setError(
          t("auth.microphoneUnavailable", {
            reason: err?.message || t("media.micPermissionDenied")
          })
        );
      }
    } catch (err: any) {
      setAuthBusy(false);
      setError(err?.message || t("error.operationFailed"));
    }
  }

  async function logout() {
    try {
      await fetch(`${serverUrl}/auth/logout`, {
        method: "POST",
        credentials: "include",
        headers: { "X-EchoVerse-Locale": locale }
      });
    } catch {}
    socket?.emit("auth:logout");
    socket?.disconnect();
    clearStoredUsername(localStorage);
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
      reader.onerror = () => reject(new Error(t("error.imageReadFailed")));
      reader.onload = () => resolve(String(reader.result || ""));
      reader.readAsDataURL(file);
    });

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(t("error.imageOpenFailed")));
      image.src = dataUrl;
    });

    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error(t("error.imageProcessFailed"));

    const crop = Math.min(img.width, img.height);
    const sx = (img.width - crop) / 2;
    const sy = (img.height - crop) / 2;

    ctx.drawImage(img, sx, sy, crop, crop, 0, 0, size, size);

    return canvas.toDataURL("image/jpeg", 0.82);
  }

  async function changeAvatar(file?: File) {
    if (!socket || !file) return;

    try {
      const avatarData = await resizeAvatar(file);

      socket.emit("profile:set-avatar", { avatarData }, (result: any) => {
        if (!result?.ok) {
          setError(result?.error || t("error.avatarFailed"));
          return;
        }

        setAccount(result.account);
        setError("");
      });
    } catch (err: any) {
      setError(err?.message || t("error.avatarFailed"));
    }
  }

  async function _identify() {
    if (!socket || !connected) return;
    try {
      const response = await fetch(`${serverUrl}/auth/session`, {
        credentials: "include",
        headers: { "X-EchoVerse-Locale": locale }
      });
      const result = await response.json();
      if (!response.ok || !result?.ok) {
        setIdentified(false);
        setAccount(null);
        return;
      }
      setAccount(result.account);
      setUsername(result.account.username);
      setIdentified(true);
    } catch {
      setIdentified(false);
      setAccount(null);
    }
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

    socket.emit("guild:create", { name }, (result: any) => {
      if (!result?.ok) {
        setError(result?.error || t("error.guildCreateFailed"));
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
        setError(result?.error || t("error.guildJoinFailed"));
        return;
      }

      setJoinCode("");
      setShowJoin(false);
      joinGuild(result.guild);
    });
  }

  async function leaveVoice(returnHome = true) {
    lobbyStateReadyRef.current = false;
    lobbyMembersRef.current = [];
    reconnectingRef.current = false;
    socket?.emit("leave-room");

    pcs.current.forEach((pc) => pc.close());
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

    videoSenders.current.forEach((sender) => {
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

    localStream.current?.getTracks().forEach((t) => t.stop());

    localStream.current = null;

    remoteAudio.current.forEach((a) => a.pause());
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

    stream.getAudioTracks().forEach((track) => {
      track.enabled = isLocalAudioEnabled(next, deafened, pushToTalk, false);
    });

    setMuted(next);
  }

  function setPeerVolume(peerId: string, volume: number) {
    setPeerVolumes((prev) => ({
      ...prev,
      [peerId]: volume
    }));

    const audio = remoteAudio.current.get(peerId);

    if (audio && !peerMuted[peerId]) {
      audio.volume = volume / 100;
    }
  }

  function togglePeerMute(peerId: string) {
    const next = !peerMuted[peerId];

    setPeerMuted((prev) => ({
      ...prev,
      [peerId]: next
    }));

    const audio = remoteAudio.current.get(peerId);

    if (audio) {
      audio.volume = next ? 0 : (peerVolumes[peerId] ?? 100) / 100;
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
        console.warn("[echoverse.video_renegotiation_failed]", peerId, err);
      }
    }
  }

  async function setOutboundVideo(track: MediaStreamTrack | null) {
    outgoingVideoTrack.current = track;

    await Promise.all(
      [...videoSenders.current.values()].map((sender) => sender.replaceTrack(track).catch(() => {}))
    );

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = track ? new MediaStream([track]) : null;
    }

    // Chromium/macOS interop: renegotiate after replacing a previously
    // inactive video sender so the receiver immediately renders the track.
    await renegotiateVideo();
  }

  async function switchCamera(deviceId: string) {
    setSelectedCamera(deviceId);
    localStorage.setItem("echoverse_camera_device", deviceId);

    if (!cameraOn) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 30 }
        },
        audio: false
      });
      const nextTrack = stream.getVideoTracks()[0];
      const oldTrack = cameraTrack.current;
      cameraTrack.current = nextTrack;
      if (!screenOn) await setOutboundVideo(nextTrack);
      oldTrack?.stop();
    } catch (err: any) {
      setError(
        t("media.cameraSwitchFailed", {
          reason: err?.message || t("media.unknownError")
        })
      );
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
          deviceId: selectedCamera ? { exact: selectedCamera } : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 30 }
        },
        audio: false
      });

      cameraTrack.current = cam.getVideoTracks()[0];

      setCameraOn(true);

      if (!screenOn) {
        await setOutboundVideo(cameraTrack.current);
      }
    } catch (err: any) {
      setError(
        t("media.cameraFailed", {
          reason: err?.message || t("media.micPermissionDenied")
        })
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
          setError(t("media.screenPermissionWeb"));
          await window.echoverse?.openScreenSettings?.();
        } else {
          setError(t("media.screenNoSources"));
        }
        return;
      }

      setScreenSources(sources);
      setShowScreenPicker(true);
    } catch (err: any) {
      setError(
        t("media.screenSourcesFailed", {
          reason: err?.message || t("media.unknownError")
        })
      );
    }
  }

  async function beginScreenShare(source: ScreenSource) {
    try {
      await window.echoverse?.selectScreenSource?.(source.id);
      setShowScreenPicker(false);

      const display = await navigator.mediaDevices.getDisplayMedia({
        video: {
          ...createScreenVideoConstraints(screenQuality, screenFps)
        },
        audio: false
      });

      const track = display.getVideoTracks()[0];

      if (!track) {
        throw new Error(t("media.screenSourceUnavailable"));
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
    } catch {
      setShowScreenPicker(false);

      const permission = await window.echoverse?.screenPermission?.();
      setScreenPermission(permission || "");

      if (permission === "denied" || permission === "restricted") {
        setError(t("media.screenPermissionWeb"));
        await window.echoverse?.openScreenSettings?.();
      } else {
        setError(t("error.operationFailed"));
      }
    }
  }

  if (!identified) {
    return (
      <div className="welcome-page">
        <div className="platform-badge">{t("platform.web")}</div>
        <div className="welcome-card auth-card">
          <div className="logo-orb">{t("app.name").slice(0, 1)}</div>
          <h1>{t("app.name")}</h1>
          <p>{t("app.tagline")}</p>

          <div className={`server-state ${connected ? "online" : "offline"}`}>
            <span className="dot" />
            {connected ? t("app.online") : t("app.connecting")}
          </div>

          <AuthForm
            mode={authMode}
            labels={{
              login: t("auth.login"),
              register: t("auth.register"),
              username: t("auth.username"),
              usernamePlaceholder: t("auth.usernamePlaceholder"),
              email: t("auth.email"),
              emailPlaceholder: t("auth.emailPlaceholder"),
              password: t("auth.password"),
              passwordPlaceholder: t("auth.passwordPlaceholder"),
              wait: t("common.wait"),
              submitLogin: t("auth.submitLogin"),
              submitRegister: t("auth.submitRegister")
            }}
            connected={connected}
            busy={authBusy}
            username={authUsername}
            email={authEmail}
            password={authPassword}
            onModeChange={(mode) => {
              setAuthMode(mode);
              setError("");
            }}
            onUsernameChange={setAuthUsername}
            onEmailChange={setAuthEmail}
            onPasswordChange={setAuthPassword}
            onSubmit={authSubmit}
          />

          <div className="v16-qol">
            <button onClick={checkForUpdates}>{t("update.checking")}</button>
            {updateProgress > 0 && updateProgress < 100 && (
              <progress max="100" value={updateProgress} />
            )}
            <button onClick={testMicrophone}>{t("media.testMicrophone")}</button>
            <span>{t("media.level", { level: micTestLevel })}</span>
            <button onClick={testOutput}>{t("media.testOutput")}</button>
            <LocaleSelect
              label={t("locale.select")}
              value={locale}
              options={[
                { value: "en", label: t("locale.english") },
                { value: "tr", label: t("locale.turkish") }
              ]}
              onChange={changeLocale}
            />
            <select value={myStatus} onChange={(e) => setPresenceStatus(e.target.value as any)}>
              <option value="online">{t("status.online")}</option>
              <option value="idle">{t("status.idle")}</option>
              <option value="dnd">{t("status.dndShort")}</option>
              <option value="invisible">{t("status.invisible")}</option>
            </select>
          </div>
          {updateStatus && <div className="update-box">{updateStatus}</div>}
          {error && <div className="error-box">{error}</div>}

          <small className="auth-version">{t("app.version", { version: appVersion })}</small>
        </div>
      </div>
    );
  }

  if (!joined) {
    return (
      <GuildPicker
        guilds={guilds}
        platformLabel={t("platform.web")}
        labels={{
          title: t("guild.list"),
          choose: t("guild.choose"),
          joinByCode: t("guild.joinByCode"),
          newGuild: t("guild.new"),
          joinGuild: t("guild.join"),
          namePlaceholder: t("guild.namePlaceholder"),
          codePlaceholder: t("guild.codePlaceholder"),
          cancel: t("guild.cancel"),
          createAction: t("guild.create"),
          joinAction: t("guild.joinAction"),
          guildCode: (id) => t("guild.code", { id })
        }}
        showCreate={showCreate}
        showJoin={showJoin}
        newGuildName={newGuildName}
        joinCode={joinCode}
        error={error}
        onCreateOpen={() => setShowCreate(true)}
        onJoinOpen={() => setShowJoin(true)}
        onCreateClose={() => setShowCreate(false)}
        onJoinClose={() => setShowJoin(false)}
        onNewGuildNameChange={setNewGuildName}
        onJoinCodeChange={setJoinCode}
        onCreateGuild={createGuild}
        onJoinGuildByCode={joinGuildByCode}
        onSelectGuild={joinGuild}
      />
    );
  }

  return (
    <div className="app">
      <div className="platform-badge">{t("platform.web")}</div>
      {connectionMessage && (
        <div className="connection-status-banner">
          <span className="connection-dot" />
          {connectionMessage}
        </div>
      )}
      <WorkspaceSidebar
        guilds={guilds}
        activeGuild={activeGuild}
        presence={presence}
        socketId={socket?.id}
        localSpeaking={localSpeaking}
        muted={muted}
        speakingPeers={speakingPeers}
        peerMuted={peerMuted}
        peerVolumes={peerVolumes}
        spotifyConfigured={spotifyConfigured}
        spotifyConnected={spotifyConnected}
        spotifyName={spotifyName}
        spotifyParty={spotifyParty}
        spotifyLeader={spotifyLeader}
        spotifyFollowing={spotifyFollowing}
        spotifyMessage={spotifyMessage}
        account={account}
        username={username}
        appVersion={appVersion}
        labels={{
          appName: t("app.name"),
          textChannels: t("guild.textChannels"),
          general: t("guild.general"),
          music: t("guild.music"),
          voiceChannels: t("guild.voiceChannels"),
          lobby: t("guild.lobby"),
          self: t("guild.self"),
          muteOnlyYou: t("media.muteOnlyYou"),
          spotifyTogether: t("spotify.together"),
          spotifyClientRequired: t("spotify.clientRequired"),
          spotifyConnect: t("spotify.connect"),
          spotifyConnected: t("spotify.connectedLabel"),
          spotifyStartParty: t("spotify.startParty"),
          spotifyStopParty: t("spotify.stopParty"),
          spotifyFollowing: t("spotify.followingLabel"),
          spotifyListenTogether: t("spotify.listenTogether"),
          spotifyLogout: t("spotify.logout"),
          changeAvatar: t("profile.changeAvatar"),
          voiceConnected: (version) => t("profile.voiceConnected", { version }),
          microphone: t("media.microphone"),
          logout: t("auth.logout"),
          createGuild: t("guild.new")
        }}
        onSelectGuild={joinGuild}
        onCreateGuild={() => {
          setJoined(false);
          setShowCreate(true);
        }}
        onTogglePeerMute={togglePeerMute}
        onPeerVolumeChange={setPeerVolume}
        onSpotifyLogin={spotifyLogin}
        onStartSpotifyParty={startSpotifyParty}
        onStopSpotifyParty={stopSpotifyParty}
        onFollowSpotifyParty={followSpotifyParty}
        onSpotifyLogout={spotifyLogout}
        onChangeAvatar={changeAvatar}
        onToggleMute={toggleMute}
        onLogout={logout}
      />

      <main className={`content ${viewMode === "dm" ? "dm-mode" : ""}`}>
        {viewMode === "dm" && activeDmFriend ? (
          <DirectMessageView
            peer={activeDmFriend}
            statusLabel={
              dmTyping[activeDmFriend.id]
                ? t("chat.typing")
                : activeDmFriend.status === "online"
                  ? t("presence.online")
                  : activeDmFriend.status === "idle"
                    ? t("presence.idle")
                    : activeDmFriend.status === "dnd"
                      ? t("presence.dnd")
                      : t("presence.offline")
            }
            searchQuery={dmSearch}
            callState={callState}
            callTime={formatCallTime(callSeconds)}
            muted={muted}
            deafened={deafened}
            pushToTalk={pushToTalk}
            pttPressed={pttPressed}
            messages={dmMessages}
            currentAccountId={account?.id || ""}
            currentUsername={username}
            currentAvatarData={account?.avatarData}
            text={dmText}
            editingLabel={editingDm ? `✏ ${t("chat.editing")}` : undefined}
            replyingLabel={
              replyTo && !editingDm
                ? `↩ ${t("chat.replyingTo", {
                    username: replyTo.senderId === account?.id ? username : activeDmFriend.username
                  })}`
                : undefined
            }
            attachmentReadyLabel={
              dmAttachment ? `📎 ${dmAttachment.name} · ${t("chat.attachmentReady")}` : undefined
            }
            dragActive={dmDragActive}
            threadRef={dmThreadRef}
            fileInputRef={dmFileInputRef}
            labels={{
              header: {
                back: t("common.back"),
                block: t("friends.block"),
                searchPlaceholder: t("chat.searchPlaceholder"),
                calling: t("call.ringing"),
                call: t("friends.call"),
                endCall: t("call.end")
              },
              call: {
                incoming: t("call.incoming"),
                ringing: t("call.ringing"),
                privateConversation: (time) => t("call.privateConversation", { time }),
                microphone: t("media.microphone"),
                mute: t("common.mute"),
                unmute: t("common.unmute"),
                deafen: t("common.deafen"),
                undeafen: t("common.undeafen"),
                pushToTalkTitle: t("call.pushToTalkTitle"),
                speaking: t("call.speaking"),
                pressToTalk: t("call.pressToTalk"),
                voiceActivity: t("call.voiceActivity"),
                close: t("common.close")
              },
              thread: {
                today: t("common.today"),
                emptyConversation: t("chat.startOfConversation", {
                  username: activeDmFriend.username
                }),
                deletedReply: t("common.deleted"),
                deletedMessage: t("chat.deleted"),
                message: t("chat.message"),
                edited: t("chat.edited"),
                download: t("common.download"),
                reply: t("common.reply"),
                edit: t("chat.editButton"),
                delete: t("chat.delete")
              },
              composer: {
                inputLabel: t("chat.message"),
                messagePlaceholder: t("chat.messagePlaceholder"),
                editPlaceholder: t("chat.edit"),
                fileLabel: t("chat.sendFile"),
                clearLabel: t("chat.clearComposerContext"),
                dragHint: t("chat.dropFile"),
                sendLabel: t("common.send"),
                saveLabel: t("common.save")
              }
            }}
            formatDate={(value) =>
              new Date(value).toLocaleDateString(locale === "tr" ? "tr-TR" : "en-US")
            }
            formatTime={(value) =>
              new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            }
            onBack={() => {
              sendTyping(false);
              setViewMode("server");
              setActiveDmFriend(null);
              setDmText("");
              setReplyTo(null);
            }}
            onSearchQueryChange={setDmSearch}
            onBlock={() => {
              if (!socket || !activeDmFriend) return;
              if (!window.confirm(t("friends.blockConfirm", { username: activeDmFriend.username })))
                return;
              socket.emit("friends:block", { targetId: activeDmFriend.id }, (result: any) => {
                if (!result?.ok) return setError(result?.error || t("friends.blockFailed"));
                setViewMode("server");
                setActiveDmFriend(null);
                loadFriends();
              });
            }}
            onCall={() => {
              if (callState === "connected" || callState === "calling") {
                stopPrivateCall(true);
              } else {
                callFriend(activeDmFriend);
              }
            }}
            onToggleMute={toggleMute}
            onToggleDeafen={toggleDeafen}
            onTogglePushToTalk={() => setPushToTalk((value) => !value)}
            onEndCall={() => stopPrivateCall(true)}
            onReply={setReplyTo}
            onReact={reactDm}
            onEdit={editDm}
            onDelete={deleteDm}
            onDownloadAttachment={downloadAttachment}
            onOpenAttachment={(data) => window.open(data, "_blank")}
            onFileSelected={(file) => void chooseDmFile(file)}
            onDropFile={(file) => void chooseDmFile(file)}
            onDragActiveChange={setDmDragActive}
            onTextChange={setDmText}
            onTypingChange={sendTyping}
            onSend={sendDm}
            onClearContext={() => {
              setReplyTo(null);
              setEditingDm(null);
              setDmAttachment(null);
              if (editingDm) setDmText("");
            }}
          />
        ) : (
          <>
            <ServerView
              guildName={activeGuild?.name}
              incomingRequestCount={incomingRequests.length}
              status={myStatus}
              videoLayout={videoLayout}
              videoStatus={
                screenOn
                  ? t("media.screenQuality", { quality: screenQuality, fps: screenFps })
                  : cameraOn
                    ? t("media.cameraOn")
                    : t("media.cameraOff")
              }
              localVideoRef={localVideoRef}
              remoteVideoHostRef={remoteVideoHost}
              localVideoActive={cameraOn || screenOn}
              localSpeaking={localSpeaking}
              muted={muted}
              cameraOn={cameraOn}
              screenOn={screenOn}
              connected={connected}
              messages={messages}
              text={text}
              error={error}
              labels={{
                topbar: {
                  general: t("guild.general"),
                  mediaSettings: t("media.videoShare"),
                  friends: t("friends.list"),
                  status: t("status.label"),
                  online: t("presence.online"),
                  idle: t("presence.idle"),
                  dnd: t("presence.dnd"),
                  invisible: t("status.invisible"),
                  noiseSuppression: t("media.noiseSuppression")
                },
                video: {
                  videoShare: t("media.videoShare"),
                  grid: t("media.grid"),
                  focus: t("media.focus")
                },
                channel: {
                  welcomeTitle: t("ui.welcomeChannel"),
                  channelBeginning: t("ui.channelBeginning", { guild: activeGuild?.name || "" })
                },
                composer: {
                  inputLabel: t("chat.message"),
                  placeholder: t("chat.sendPlaceholder"),
                  emojiLabel: t("chat.emoji"),
                  sendLabel: t("common.send")
                },
                voice: {
                  mute: t("common.mute"),
                  microphone: t("media.microphone"),
                  camera: t("media.camera"),
                  cameraOff: t("media.cameraOff"),
                  screenShare: t("media.screenShare"),
                  stopScreenShare: t("media.stopScreenShare"),
                  endCall: t("common.endCall"),
                  online: t("connection.online"),
                  offline: t("connection.offline")
                }
              }}
              formatDate={(value) => formatLocaleDate(value, locale)}
              onOpenMediaSettings={() => {
                refreshAudioDevices();
                setShowAudioSettings(true);
              }}
              onOpenFriends={() => {
                loadFriends();
                setShowFriends(true);
              }}
              onStatusChange={setPresenceStatus}
              onVideoLayoutChange={setVideoLayout}
              onTextChange={setText}
              onAddEmoji={() => setText((value) => `${value} 😂`)}
              onSendMessage={sendMessage}
              onToggleMute={toggleMute}
              onToggleCamera={toggleCamera}
              onToggleScreen={toggleScreen}
              onEndCall={() => leaveVoice(true)}
              onDismissError={() => setError("")}
            />
          </>
        )}
      </main>

      <WorkspaceOverlays
        presence={presence}
        socketId={socket?.id}
        localSpeaking={localSpeaking}
        muted={muted}
        speakingPeers={speakingPeers}
        peerMuted={peerMuted}
        peerVolumes={peerVolumes}
        showAudioSettings={showAudioSettings}
        audioInputs={audioInputs}
        audioOutputs={audioOutputs}
        videoInputs={videoInputs}
        selectedInput={selectedInput}
        selectedOutput={selectedOutput}
        selectedCamera={selectedCamera}
        screenQuality={screenQuality}
        screenFps={screenFps}
        lobbySoundsEnabled={lobbySoundsEnabled}
        effectVolume={effectVolume}
        showFriends={showFriends}
        friends={friends}
        incomingRequests={incomingRequests}
        friendSearchResults={friendSearchResults}
        unreadDm={unreadDm}
        friendSearch={friendSearch}
        incomingCall={incomingCall}
        privateCallPeer={privateCallPeer}
        ringing={ringing}
        callTime={formatCallTime(callSeconds)}
        showScreenPicker={showScreenPicker}
        screenSources={screenSources}
        screenPermission={screenPermission}
        showCreate={showCreate}
        newGuildName={newGuildName}
        labels={{
          members: {
            onlineCount: (count) => t("ui.onlineCount", { count }),
            botsCount: t("ui.botsCount"),
            self: t("guild.self"),
            muteOnlyYou: t("media.muteOnlyYou"),
            muted: t("media.mutedShort"),
            volumeFor: (username) => t("media.volumeFor", { username }),
            botName: t("bot.name"),
            botHelp: t("bot.helpCommand")
          },
          media: {
            title: t("media.audioVideoSettings"),
            description: t("media.settingsDescription"),
            microphoneInput: t("media.microphoneInput"),
            speakerOutput: t("media.speakerOutput"),
            speakerFallback: (id) => t("media.speakerFallback", { id }),
            systemDefault: t("media.systemDefault"),
            videoSection: t("media.videoSection"),
            cameraInput: t("media.cameraInput"),
            microphoneFallback: (id) => t("media.microphoneFallback", { id }),
            cameraFallback: (id) => t("media.cameraFallback", { id }),
            screenQualityLabel: t("media.screenQualityLabel"),
            quality: (quality) => t("media.quality", { quality }),
            fps: t("media.fps"),
            shareProfile: (quality, fps) => t("media.shareProfile", { quality, fps }),
            changeNotice: t("media.changeNotice"),
            lobbySounds: t("media.lobbySounds"),
            lobbySoundsDescription: t("media.lobbySoundsDescription"),
            effectVolume: (volume) => t("media.effectVolume", { volume }),
            close: t("common.close")
          },
          friends: {
            title: t("ui.friends"),
            close: t("common.close"),
            searchPlaceholder: t("friends.searchPlaceholder"),
            search: t("friends.search"),
            searchResults: t("ui.searchResults"),
            incomingRequests: t("ui.incomingRequests"),
            myFriends: t("ui.myFriends"),
            noFriends: t("ui.noFriends"),
            add: t("friends.add"),
            accept: t("common.accept"),
            decline: t("common.reject"),
            openDirectMessage: t("friends.openDm"),
            call: t("friends.call"),
            remove: t("common.remove")
          },
          calls: {
            incomingPrivateCall: t("ui.incomingPrivateCall"),
            answer: t("common.accept"),
            reject: t("common.reject"),
            endCall: t("common.endCall"),
            ringing: t("call.ringing"),
            privateConversation: (time) => t("call.privateConversation", { time })
          },
          screen: {
            title: t("ui.screenShare"),
            chooseSource: t("ui.chooseSource"),
            close: t("common.close"),
            permissionOff: t("ui.screenPermissionOff"),
            openSystemSettings: t("ui.openSystemSettings")
          },
          guild: {
            title: t("guild.new"),
            namePlaceholder: t("guild.namePlaceholder"),
            cancel: t("guild.cancel"),
            create: t("guild.create")
          }
        }}
        onTogglePeerMute={togglePeerMute}
        onPeerVolumeChange={setPeerVolume}
        onInputChange={switchInput}
        onOutputChange={switchOutput}
        onCameraChange={switchCamera}
        onScreenQualityChange={(value) => {
          setScreenQuality(value);
          localStorage.setItem("echoverse_screen_quality", value);
        }}
        onScreenFpsChange={(value) => {
          setScreenFps(value);
          localStorage.setItem("echoverse_screen_fps", String(value));
        }}
        onLobbySoundsChange={(enabled) => {
          setLobbySoundsEnabled(enabled);
          localStorage.setItem("echoverse_lobby_sounds", enabled ? "on" : "off");
        }}
        onEffectVolumeChange={(value) => {
          setEffectVolume(value);
          localStorage.setItem("echoverse_effect_volume", String(value));
        }}
        onCloseAudioSettings={() => setShowAudioSettings(false)}
        onCloseFriends={() => setShowFriends(false)}
        onFriendSearchChange={setFriendSearch}
        onSearchFriends={searchFriends}
        onSendFriendRequest={sendFriendRequest}
        onRespondFriendRequest={respondFriendRequest}
        onOpenDm={openDm}
        onCallFriend={callFriend}
        onRemoveFriend={removeFriend}
        onAnswerCall={answerIncomingCall}
        onEndCall={() => stopPrivateCall(true)}
        onCloseScreenPicker={() => setShowScreenPicker(false)}
        onOpenSystemSettings={() => void window.echoverse?.openScreenSettings?.()}
        onSelectScreenSource={beginScreenShare}
        onGuildNameChange={setNewGuildName}
        onCancelCreate={() => setShowCreate(false)}
        onCreateGuild={createGuild}
      />
    </div>
  );
}
