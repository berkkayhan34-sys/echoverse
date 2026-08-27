import React, { useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { createTranslator, formatLocaleDate } from "@echoverse/contracts";
import {
  appendDmMessage,
  applyDmReaction,
  clearStoredUsername,
  createAuthRequest,
  createScreenVideoConstraints,
  createSocketAuth,
  deleteDmMessage,
  getLobbyMemberTransition,
  readClientLocale,
  readStoredUsername,
  resolveClientLocale,
  isLocalAudioEnabled,
  updateDmMessage,
  updateFriendPresence,
  updateTypingState,
  writeClientLocale,
  writeStoredUsername
} from "@echoverse/client-core";
import { AuthForm, LocaleSelect } from "@echoverse/shared-ui";
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

const EV_SOUNDS = {
  join: "./sounds/voice-join.wav",
  leave: "./sounds/voice-leave.wav",
  message: "./sounds/message.wav",
  mic: "./sounds/mic-toggle.wav",
  call: "./sounds/incoming-call.wav",
  outgoing: "./sounds/outgoing-call.wav",
  connected: "./sounds/call-connected.wav",
  ended: "./sounds/call-ended.wav",
  deafen: "./sounds/deafen-toggle.wav",
  screenShare: "./sounds/screen-share-toggle.wav",
  mention: "./sounds/mention.wav"
} as const;

type DesktopAuthSession = {
  accessToken: string;
  refreshToken: string;
  account: Account;
};

function resolveEvSoundUrl(path: string) {
  // Resolve against the renderer document in both Vite and packaged builds.
  return typeof document === "undefined" ? path : new URL(path, document.baseURI).toString();
}

function playEvSound(key: keyof typeof EV_SOUNDS, volume = 0.55, loop = false) {
  try {
    const audio = new Audio(resolveEvSoundUrl(EV_SOUNDS[key]));
    audio.preload = "auto";
    audio.volume = Math.max(0, Math.min(1, volume));
    audio.loop = loop;
    audio.play()?.catch((error) => {
      console.warn(`[echoverse.sound_playback_failed:${key}]`, error);
    });
    return audio;
  } catch {
    return null;
  }
}

async function _tuneEchoVerseScreenSender(sender: RTCRtpSender, fps: 30 | 60 = 30) {
  try {
    const params = sender.getParameters();
    if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
    params.encodings[0].maxBitrate = fps === 60 ? 10_000_000 : 8_000_000;
    params.encodings[0].maxFramerate = fps;
    params.degradationPreference = "maintain-resolution";
    await sender.setParameters(params);
  } catch {}
}

function _tuneEchoVerseScreenTrack(track: MediaStreamTrack) {
  try {
    track.contentHint = "detail";
  } catch {}
}

export default function App() {
  const [serverUrl, setServerUrl] = useState("");
  const [locale, setLocale] = useState<Locale>(() =>
    readClientLocale(localStorage, navigator.language)
  );
  const t = useMemo(() => createTranslator(locale), [locale]);
  const translatorRef = useRef(t);
  const [spotifyConfigured, setSpotifyConfigured] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const authSessionRef = useRef<DesktopAuthSession | null>(null);
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

  useEffect(() => {
    translatorRef.current = t;
  }, [t]);

  useEffect(() => {
    document.documentElement.lang = locale;
    writeClientLocale(localStorage, locale);
    void window.echoverse?.setLocale?.(locale);
  }, [locale]);

  useEffect(() => {
    document.title = t("app.name");
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

  useEffect(() => {
    // Unlock Chromium media playback from the first user gesture so sounds
    // received later through Socket.IO are not rejected as autoplay.
    const unlockAudio = () => {
      const probe = new Audio(resolveEvSoundUrl(EV_SOUNDS.mic));
      probe.muted = true;
      probe.preload = "auto";
      probe
        .play()
        ?.then(() => {
          probe.pause();
          probe.currentTime = 0;
        })
        .catch(() => {});
      window.removeEventListener("pointerdown", unlockAudio, true);
      window.removeEventListener("keydown", unlockAudio, true);
    };

    window.addEventListener("pointerdown", unlockAudio, true);
    window.addEventListener("keydown", unlockAudio, true);
    return () => {
      window.removeEventListener("pointerdown", unlockAudio, true);
      window.removeEventListener("keydown", unlockAudio, true);
    };
  }, []);

  function playLobbyTone(kind: "join" | "leave") {
    if (!lobbySoundsEnabledRef.current) return;
    const now = Date.now();
    if (now - lobbySoundCooldown.current < 180) return;
    lobbySoundCooldown.current = now;

    const volume = Math.max(0, Math.min(1, effectVolumeRef.current / 100));
    playEvSound(kind, volume);
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
            serverUrl: "http://localhost:3001",
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

    const removeUpdateState: (() => void) | void = window.echoverse?.onUpdateState?.(
      (state: any) => {
        setUpdatePhase(state?.phase || "idle");
        setUpdateStatus(state?.status || "");
        setUpdateProgress(Number(state?.percent || 0));
        setUpdateVersion(state?.version || null);
      }
    );

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

    // Backward compatibility with older preload builds.
    const removeLegacy = window.echoverse?.onUpdateStatus?.((status: string) => {
      setUpdateStatus(status);
      const progress = status.match(/(\d{1,3})%/);
      if (progress) setUpdateProgress(Number(progress[1]));
    });

    return () => {
      try {
        removeUpdateState?.();
      } catch {}
      try {
        removeLegacy?.();
      } catch {}
    };
  }, []);

  useEffect(() => {
    if (!serverUrl) return;

    const s = io(serverUrl, {
      transports: ["websocket", "polling"],
      reconnection: true,
      auth: createSocketAuth(locale, "desktop")
    });

    setSocket(s);

    s.on("connect", () => {
      setConnected(true);
      setConnectionMessage("");
      setError("");

      void window.echoverse?.authSession
        ?.get?.()
        .then((stored) => {
          if (!stored) return;
          authSessionRef.current = stored;
          s.emit("auth:resume", { refreshToken: stored.refreshToken }, async (result: any) => {
            if (!result?.ok || !result.accessToken || !result.refreshToken) {
              await window.echoverse?.authSession?.clear?.();
              authSessionRef.current = null;
              setAccount(null);
              setIdentified(false);
              return;
            }

            const nextSession: DesktopAuthSession = {
              accessToken: result.accessToken,
              refreshToken: result.refreshToken,
              account: result.account
            };
            await window.echoverse?.authSession?.set?.(nextSession);
            authSessionRef.current = nextSession;
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
        })
        .catch(() => {
          setAccount(null);
          setIdentified(false);
        });
    });

    s.on("disconnect", () => {
      setConnected(false);
      reconnectingRef.current = true;
      lobbyStateReadyRef.current = false;
      setConnectionMessage(translatorRef.current("connection.lost"));
    });

    s.on("connect_error", () => {
      setConnected(false);
      setConnectionMessage(translatorRef.current("connection.retrying"));
      setError(translatorRef.current("error.connectionFailed"));
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
          setUnreadDm((prev) => ({ ...prev, [currentFriend.id]: 0 }));
        }
      }

      if (currentAccount && msg.senderId !== currentAccount.id) {
        const volume = Math.max(0, Math.min(1, effectVolumeRef.current / 100));
        playEvSound("message", volume);
        if (currentAccount.username && msg.body.includes(`@${currentAccount.username}`)) {
          playEvSound("mention", volume);
        }
        if (!isOpenConversation) {
          setUnreadDm((prev) => ({
            ...prev,
            [msg.senderId]: (prev[msg.senderId] || 0) + 1
          }));

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
      playEvSound("connected", Math.max(0, Math.min(1, effectVolumeRef.current / 100)));
      await createPeer(s, result.responderSocketId, true);
    });

    s.on("call:ended", () => {
      stopPrivateCall(false);
    });

    s.on("chat-message", (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
      const currentAccount = accountRef.current;
      if (
        currentAccount &&
        msg.username !== currentAccount.username &&
        currentAccount.username &&
        msg.text.includes(`@${currentAccount.username}`)
      ) {
        playEvSound("mention", Math.max(0, Math.min(1, effectVolumeRef.current / 100)));
      }
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

  async function refreshAudioDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAudioInputs(devices.filter((d) => d.kind === "audioinput"));
      setAudioOutputs(devices.filter((d) => d.kind === "audiooutput"));
      setVideoInputs(devices.filter((d) => d.kind === "videoinput"));
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
      const sender = pc.getSenders().find((s) => s.track?.kind === "audio");
      if (sender) {
        await sender.replaceTrack(newTrack);
      }
    }

    old?.getAudioTracks().forEach((t) => t.stop());
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
        setError(result?.error || t("error.requestFailed"));
        return;
      }
      setFriendSearchResults([]);
      setFriendSearch("");
      loadFriends();
    });
  }

  function respondFriendRequest(friendshipId: string, accept: boolean) {
    socket?.emit("friends:respond", { friendshipId, accept }, (result: any) => {
      if (!result?.ok) {
        setError(result?.error || t("error.requestFailed"));
        return;
      }
      loadFriends();
    });
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
    setUnreadDm((prev) => ({ ...prev, [friend.id]: 0 }));

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
        if (!result?.ok) setError(result?.error || t("chat.editFailed"));
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
          setError(result?.error || t("chat.sendFailed"));
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
    if (!window.confirm(t("chat.deleteConfirm"))) return;

    socket.emit("dm:delete", { messageId: message.id }, (result: any) => {
      if (!result?.ok) setError(result?.error || t("chat.deleteFailed"));
    });
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
    playEvSound("deafen", 0.55);
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

  async function installReadyUpdate() {
    const result = await window.echoverse?.installUpdate?.();
    if (!result?.ok) {
      setUpdateStatus(result?.error || t("update.installFailed"));
    }
  }

  function updaterBanner() {
    if (!updateStatus) return null;

    return (
      <div className={`global-update-banner ${updatePhase === "error" ? "error" : ""}`}>
        <div className="global-update-copy">
          <b>
            {updatePhase === "error"
              ? t("update.problem")
              : updateVersion
                ? t("update.version", { version: updateVersion })
                : t("update.client")}
          </b>
          <span>{updateStatus}</span>
          {updatePhase === "downloading" && <progress max="100" value={updateProgress} />}
        </div>

        <div className="global-update-actions">
          {updatePhase === "ready" && (
            <button onClick={installReadyUpdate}>{t("update.restart")}</button>
          )}
          {updatePhase === "error" && (
            <button onClick={checkForUpdates}>{t("update.retry")}</button>
          )}
        </div>
      </div>
    );
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
  function reactDm(messageId: string, emoji: string) {
    socket?.emit("dm:react", { messageId, emoji });
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
    const volume = Math.max(0, Math.min(1, effectVolumeRef.current / 100));
    const audio = playEvSound("call", volume, true);
    ringAudio.current = audio;
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
    playEvSound("ended", Math.max(0, Math.min(1, effectVolumeRef.current / 100)));
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
    playEvSound("outgoing", Math.max(0, Math.min(1, effectVolumeRef.current / 100)));
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
      playEvSound("connected", Math.max(0, Math.min(1, effectVolumeRef.current / 100)));
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
    if (!socket || !connected || authBusy) return;

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

    socket.emit(authRequest.event, authRequest.payload, async (result: any) => {
      setAuthBusy(false);

      if (!result?.ok) {
        setError(result?.error || t("error.operationFailed"));
        return;
      }

      if (!result.accessToken || !result.refreshToken || !window.echoverse?.authSession) {
        setError(t("auth.secureStorageUnavailable"));
        return;
      }
      const nextSession: DesktopAuthSession = {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        account: result.account
      };
      try {
        await window.echoverse.authSession.set(nextSession);
      } catch {
        setError(t("auth.secureStorageWriteFailed"));
        return;
      }
      authSessionRef.current = nextSession;
      writeStoredUsername(localStorage, result.account.username);

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
          t("auth.microphoneUnavailable", {
            reason: err?.message || t("media.micPermissionDenied")
          })
        );
      }
    });
  }

  async function logout() {
    socket?.emit("auth:logout", { token: authSessionRef.current?.accessToken });
    await window.echoverse?.authSession?.clear?.();
    authSessionRef.current = null;
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
    const stored = await window.echoverse?.authSession?.get?.();
    if (!stored) {
      setIdentified(false);
      setAccount(null);
      return;
    }
    socket.emit("auth:resume", { refreshToken: stored.refreshToken }, async (result: any) => {
      if (!result?.ok) {
        await window.echoverse?.authSession?.clear?.();
        setIdentified(false);
        setAccount(null);
        return;
      }
      const nextSession: DesktopAuthSession = {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        account: result.account
      };
      await window.echoverse?.authSession?.set?.(nextSession);
      authSessionRef.current = nextSession;
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
    playEvSound("mic", 0.78);
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
      playEvSound("screenShare", Math.max(0, Math.min(1, effectVolumeRef.current / 100)));
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
          setError(t("media.screenPermissionDesktop"));
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
      playEvSound("screenShare", Math.max(0, Math.min(1, effectVolumeRef.current / 100)));

      track.onended = async () => {
        if (screenTrack.current?.id !== track.id) return;

        screenTrack.current = null;
        setScreenOn(false);
        await setOutboundVideo(cameraTrack.current);
        playEvSound("screenShare", Math.max(0, Math.min(1, effectVolumeRef.current / 100)));
      };
    } catch {
      setShowScreenPicker(false);

      const permission = await window.echoverse?.screenPermission?.();
      setScreenPermission(permission || "");

      if (permission === "denied" || permission === "restricted") {
        setError(t("media.screenPermissionDesktop"));
        await window.echoverse?.openScreenSettings?.();
      } else {
        setError(t("error.operationFailed"));
      }
    }
  }

  if (!identified) {
    return (
      <div className="welcome-page">
        {updaterBanner()}
        <div className="welcome-card auth-card">
          <img className="auth-app-icon" src="./echoverse-icon.png" alt="" />
          <img className="echoverse-wordmark" src="./echoverse-wordmark.png" alt={t("app.name")} />
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
      <div className="welcome-page">
        {updaterBanner()}
        <div className="welcome-card guild-picker">
          <div className="picker-head">
            <div>
              <h1>{t("guild.list")}</h1>
              <p>{t("guild.choose")}</p>
            </div>

            <button className="icon-btn" onClick={() => setShowCreate(true)}>
              ＋
            </button>
          </div>

          <div className="guild-list">
            {guilds.map((g) => (
              <button className="guild-row" key={g.id} onClick={() => joinGuild(g)}>
                <span className="guild-badge">{g.name.slice(0, 2).toUpperCase()}</span>

                <span>
                  <b>{g.name}</b>
                  <small>{t("guild.code", { id: g.id })}</small>
                </span>
              </button>
            ))}
          </div>

          <button className="secondary-wide" onClick={() => setShowJoin(true)}>
            {t("guild.joinByCode")}
          </button>

          {showCreate && (
            <div className="modal-backdrop">
              <div className="modal">
                <h2>{t("guild.new")}</h2>

                <input
                  autoFocus
                  placeholder={t("guild.namePlaceholder")}
                  value={newGuildName}
                  onChange={(e) => setNewGuildName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createGuild()}
                />

                <div className="modal-actions">
                  <button onClick={() => setShowCreate(false)}>{t("guild.cancel")}</button>

                  <button className="primary-small" onClick={createGuild}>
                    {t("guild.create")}
                  </button>
                </div>
              </div>
            </div>
          )}

          {showJoin && (
            <div className="modal-backdrop">
              <div className="modal">
                <h2>{t("guild.join")}</h2>

                <input
                  autoFocus
                  placeholder={t("guild.codePlaceholder")}
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && joinGuildByCode()}
                />

                <div className="modal-actions">
                  <button onClick={() => setShowJoin(false)}>{t("guild.cancel")}</button>

                  <button className="primary-small" onClick={joinGuildByCode}>
                    {t("guild.joinAction")}
                  </button>
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
      {updaterBanner()}
      {connectionMessage && (
        <div className="connection-status-banner">
          <span className="connection-dot" />
          {connectionMessage}
        </div>
      )}
      <aside className="servers">
        <div className="server-logo">{t("app.name").slice(0, 1)}</div>

        {guilds.map((g) => (
          <button
            key={g.id}
            title={`${g.name} • ${g.id}`}
            className={`server-circle ${activeGuild?.id === g.id ? "active" : ""}`}
            onClick={() => joinGuild(g)}
          >
            {g.name.slice(0, 2).toUpperCase()}
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
          <small className="guild-code">#{activeGuild?.id}</small>
        </div>

        <div className="channel-group">
          <div className="channel-title">{t("guild.textChannels")}</div>
          <button className="channel active"># {t("guild.general")}</button>
          <button className="channel"># {t("guild.music")}</button>
        </div>

        <div className="channel-group">
          <div className="channel-title">{t("guild.voiceChannels")}</div>

          <button className="channel voice active">🔊 {t("guild.lobby")}</button>

          <div className="voice-users">
            {presence.map((p) => {
              const isSelf = p.socketId === socket?.id;
              const speaking = isSelf
                ? localSpeaking && !muted
                : !!speakingPeers[p.socketId] && !peerMuted[p.socketId];

              return (
                <div className={`voice-user-row ${speaking ? "speaking" : ""}`} key={p.socketId}>
                  <div className="voice-user">
                    {p.avatarData ? (
                      <img className="voice-avatar" src={p.avatarData} alt="" />
                    ) : (
                      <span className="mini-dot" />
                    )}
                    {p.username}
                    {isSelf ? t("guild.self") : ""}
                  </div>

                  {!isSelf && (
                    <div className="voice-peer-controls">
                      <button
                        className={peerMuted[p.socketId] ? "peer-muted" : ""}
                        onClick={() => togglePeerMute(p.socketId)}
                        title={t("media.muteOnlyYou")}
                      >
                        {peerMuted[p.socketId] ? "🔇" : "🔊"}
                      </button>

                      <input
                        type="range"
                        min="0"
                        max="200"
                        value={peerVolumes[p.socketId] ?? 100}
                        onChange={(e) => setPeerVolume(p.socketId, Number(e.target.value))}
                      />

                      <span>
                        {peerMuted[p.socketId] ? "M" : `${peerVolumes[p.socketId] ?? 100}%`}
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
            <b>{t("spotify.together")}</b>
            <span className="spotify-dot" />
          </div>

          {!spotifyConfigured ? (
            <small>{t("spotify.clientRequired")}</small>
          ) : !spotifyConnected ? (
            <button className="spotify-connect" onClick={spotifyLogin}>
              {t("spotify.connect")}
            </button>
          ) : (
            <>
              <small>{spotifyName || t("spotify.connectedLabel")}</small>

              {spotifyParty?.active && (
                <div className="spotify-now">
                  {spotifyParty.albumImage && <img src={spotifyParty.albumImage} />}

                  <div>
                    <b>{spotifyParty.trackName || t("spotify.together")}</b>
                    <small>{spotifyParty.artistName || spotifyParty.leaderUsername}</small>
                  </div>
                </div>
              )}

              {!spotifyParty?.active ? (
                <button className="spotify-action" onClick={startSpotifyParty}>
                  ▶ {t("spotify.startParty")}
                </button>
              ) : spotifyLeader ? (
                <button className="spotify-stop" onClick={stopSpotifyParty}>
                  ■ {t("spotify.stopParty")}
                </button>
              ) : (
                <button
                  className={spotifyFollowing ? "spotify-following" : "spotify-action"}
                  onClick={followSpotifyParty}
                >
                  {spotifyFollowing
                    ? `✓ ${t("spotify.followingLabel")}`
                    : `🎧 ${t("spotify.listenTogether")}`}
                </button>
              )}

              <button className="spotify-logout" onClick={spotifyLogout}>
                {t("spotify.logout")}
              </button>
            </>
          )}

          {spotifyMessage && <div className="spotify-message">{spotifyMessage}</div>}
        </div>

        <div className="user-panel">
          <label className="user-avatar avatar-upload-label" title={t("profile.changeAvatar")}>
            {account?.avatarData ? (
              <img src={account.avatarData} alt="" />
            ) : (
              username.slice(0, 2).toUpperCase()
            )}

            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                changeAvatar(file);
                e.currentTarget.value = "";
              }}
            />
          </label>

          <div className="user-info">
            <b>{username}</b>
            <small>{t("profile.voiceConnected", { version: appVersion })}</small>
          </div>

          <button onClick={toggleMute} title={t("media.microphone")}>
            {muted ? "🔇" : "🎙️"}
          </button>

          <button onClick={logout} title={t("auth.logout")}>
            ↪
          </button>
        </div>
      </aside>

      <main className={`content ${viewMode === "dm" ? "dm-mode" : ""}`}>
        {viewMode === "dm" && activeDmFriend ? (
          <div className="dm-fullpage">
            <header className="dm-page-header">
              <div className="dm-page-user">
                <button
                  className="dm-back"
                  onClick={() => {
                    sendTyping(false);
                    setViewMode("server");
                    setActiveDmFriend(null);
                    setDmText("");
                    setReplyTo(null);
                  }}
                >
                  ←
                </button>

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
                      ? t("chat.typing")
                      : activeDmFriend.status === "online"
                        ? t("presence.online")
                        : activeDmFriend.status === "idle"
                          ? t("presence.idle")
                          : activeDmFriend.status === "dnd"
                            ? t("presence.dnd")
                            : t("presence.offline")}
                  </small>
                </div>
              </div>

              <div className="dm-page-actions">
                <input
                  className="dm-header-search"
                  value={dmSearch}
                  onChange={(e) => setDmSearch(e.target.value)}
                  placeholder={t("chat.searchPlaceholder")}
                />
                <button
                  className="dm-block-button"
                  title={t("friends.block")}
                  onClick={() => {
                    if (!socket || !activeDmFriend) return;
                    if (
                      !window.confirm(
                        t("friends.blockConfirm", { username: activeDmFriend.username })
                      )
                    )
                      return;
                    socket.emit("friends:block", { targetId: activeDmFriend.id }, (result: any) => {
                      if (!result?.ok) return setError(result?.error || t("friends.blockFailed"));
                      setViewMode("server");
                      setActiveDmFriend(null);
                      loadFriends();
                    });
                  }}
                >
                  🚫
                </button>
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
                    ? `📞 ${t("call.ringing")}`
                    : callState === "connected"
                      ? `☎ ${t("call.end")}`
                      : `📞 ${t("friends.call")}`}
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
                    ? t("call.ringing")
                    : callState === "connected"
                      ? t("call.privateConversation", { time: formatCallTime(callSeconds) })
                      : t("call.incoming")}
                </p>

                {callState === "connected" && (
                  <div className="private-call-controls">
                    <button onClick={toggleMute}>
                      {muted ? `🔇 ${t("common.unmute")}` : `🎙️ ${t("media.microphone")}`}
                    </button>
                    <button onClick={toggleDeafen}>
                      {deafened ? `🔊 ${t("common.undeafen")}` : `🎧 ${t("common.deafen")}`}
                    </button>
                    <button
                      className={pushToTalk ? "active" : ""}
                      onClick={() => setPushToTalk((v) => !v)}
                      title={t("call.pushToTalkTitle")}
                    >
                      {pushToTalk
                        ? pttPressed
                          ? `🟢 ${t("call.speaking")}`
                          : `⌨ ${t("call.pressToTalk")}`
                        : `🎙 ${t("call.voiceActivity")}`}
                    </button>
                    <button className="hangup" onClick={() => stopPrivateCall(true)}>
                      ☎ {t("common.close")}
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
                  <p>{t("chat.startOfConversation", { username: activeDmFriend.username })}</p>
                </div>
              )}

              {dmMessages
                .filter((m) => {
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
                    !previousDate || previousDate.toDateString() !== currentDate.toDateString();

                  const replied = m.replyToId
                    ? dmMessages.find((candidate) => candidate.id === m.replyToId)
                    : null;

                  return (
                    <React.Fragment key={m.id}>
                      {showDate && (
                        <div className="dm-date-divider">
                          <span>
                            {currentDate.toDateString() === new Date().toDateString()
                              ? t("common.today")
                              : currentDate.toLocaleDateString()}
                          </span>
                        </div>
                      )}

                      <div
                        className={`dm-discord-message ${mine ? "mine" : ""} ${m.deletedAt ? "deleted" : ""}`}
                      >
                        <div className="avatar">
                          {mine && account?.avatarData ? (
                            <img src={account.avatarData} alt="" />
                          ) : !mine && activeDmFriend.avatarData ? (
                            <img src={activeDmFriend.avatarData} alt="" />
                          ) : (
                            (mine ? username : activeDmFriend.username).slice(0, 2).toUpperCase()
                          )}
                        </div>

                        <div className="dm-discord-body">
                          <div className="dm-discord-meta">
                            <b>{mine ? username : activeDmFriend.username}</b>
                            <small>
                              {currentDate.toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit"
                              })}
                            </small>
                            {m.editedAt && !m.deletedAt && <small>{t("chat.edited")}</small>}
                          </div>

                          {replied && (
                            <div className="dm-reply-preview">
                              ↪{" "}
                              {replied.deletedAt
                                ? t("common.deleted")
                                : replied.body || replied.attachmentName || t("chat.message")}
                            </div>
                          )}

                          {m.deletedAt ? (
                            <div className="dm-deleted-text">{t("chat.deleted")}</div>
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
                                    <button onClick={() => downloadAttachment(m)}>
                                      {t("common.download")}
                                    </button>
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
                              <button onClick={() => setReplyTo(m)}>↩ {t("common.reply")}</button>
                              {["👍", "❤️", "😂", "🔥"].map((emoji) => (
                                <button key={emoji} onClick={() => reactDm(m.id, emoji)}>
                                  {emoji}
                                </button>
                              ))}
                              {mine && (
                                <button onClick={() => editDm(m)}>✏ {t("chat.editButton")}</button>
                              )}
                              {mine && (
                                <button className="danger" onClick={() => deleteDm(m)}>
                                  🗑 {t("chat.delete")}
                                </button>
                              )}
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
                  {editingDm && <span>✏ {t("chat.editing")}</span>}
                  {replyTo && !editingDm && (
                    <span>
                      ↩{" "}
                      {t("chat.replyingTo", {
                        username:
                          replyTo.senderId === account?.id ? username : activeDmFriend.username
                      })}
                    </span>
                  )}
                  {dmAttachment && (
                    <span>
                      📎 {dmAttachment.name} · {t("chat.attachmentReady")}
                    </span>
                  )}
                  <button
                    onClick={() => {
                      setReplyTo(null);
                      setEditingDm(null);
                      setDmAttachment(null);
                      if (editingDm) setDmText("");
                    }}
                  >
                    ✕
                  </button>
                </div>
              )}

              <div
                className={`dm-page-composer ${dmDragActive ? "drag-active" : ""}`}
                onDragEnter={(e) => {
                  e.preventDefault();
                  setDmDragActive(true);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDmDragActive(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setDmDragActive(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDmDragActive(false);
                  chooseDmFile(e.dataTransfer.files?.[0] || null);
                }}
              >
                {dmDragActive && <div className="dm-drop-hint">{t("chat.dropFile")}</div>}
                <input
                  ref={dmFileInputRef}
                  type="file"
                  className="hidden-file-input"
                  onChange={(e) => {
                    chooseDmFile(e.target.files?.[0] || null);
                    e.currentTarget.value = "";
                  }}
                />

                <button
                  className="dm-attach-button"
                  title={t("chat.sendFile")}
                  onClick={() => dmFileInputRef.current?.click()}
                >
                  ＋
                </button>

                <input
                  value={dmText}
                  onFocus={() => sendTyping(true)}
                  onBlur={() => sendTyping(false)}
                  onChange={(e) => {
                    setDmText(e.target.value);
                    sendTyping(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendDm();
                    }
                  }}
                  placeholder={editingDm ? t("chat.edit") : t("chat.messagePlaceholder")}
                />
                <button onClick={sendDm}>{editingDm ? t("common.save") : t("common.send")}</button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <header className="topbar">
              <div>
                <b># {t("guild.general")}</b>
                <span>{activeGuild?.name}</span>
              </div>

              <div className="top-actions">
                <button
                  onClick={() => {
                    refreshAudioDevices();
                    setShowAudioSettings(true);
                  }}
                >
                  ⚙ {t("media.videoShare")}
                </button>

                <button
                  onClick={() => {
                    loadFriends();
                    setShowFriends(true);
                  }}
                >
                  👥 {t("friends.list")}
                  {incomingRequests.length > 0 ? ` (${incomingRequests.length})` : ""}
                </button>

                <select
                  className="presence-select"
                  value={myStatus}
                  onChange={(e) => setPresenceStatus(e.target.value as any)}
                  title={t("status.label")}
                >
                  <option value="online">🟢 {t("presence.online")}</option>
                  <option value="idle">🌙 {t("presence.idle")}</option>
                  <option value="dnd">⛔ {t("presence.dnd")}</option>
                  <option value="invisible">⚫ {t("status.invisible")}</option>
                </select>

                <div className="top-state">✨ {t("media.noiseSuppression")}</div>
              </div>
            </header>

            <div className="video-toolbar">
              <div>
                <b>{t("media.videoShare")}</b>
                <span>
                  {screenOn
                    ? t("media.screenQuality", { quality: screenQuality, fps: screenFps })
                    : cameraOn
                      ? t("media.cameraOn")
                      : t("media.cameraOff")}
                </span>
              </div>
              <div className="video-layout-actions">
                <button
                  className={videoLayout === "grid" ? "active" : ""}
                  onClick={() => setVideoLayout("grid")}
                >
                  ▦ {t("media.grid")}
                </button>
                <button
                  className={videoLayout === "focus" ? "active" : ""}
                  onClick={() => setVideoLayout("focus")}
                >
                  ▣ {t("media.focus")}
                </button>
              </div>
            </div>

            <div
              className={`video-zone ${videoLayout === "focus" ? "focus-layout" : "grid-layout"}`}
            >
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

              <div ref={remoteVideoHost} className="remote-video-host" />
            </div>

            <section className="message-list">
              <div className="channel-intro">
                <div className="big-hash">#</div>

                <h2>{t("ui.welcomeChannel")}</h2>

                <p>{t("ui.channelBeginning", { guild: activeGuild?.name || "" })}</p>
              </div>

              {messages.map((m) => (
                <div className="message" key={m.id}>
                  <div className={`avatar ${m.bot ? "bot" : ""}`}>
                    {!m.bot && m.avatarData ? (
                      <img src={m.avatarData} alt="" />
                    ) : m.bot ? (
                      "EB"
                    ) : (
                      m.username.slice(0, 2).toUpperCase()
                    )}
                  </div>

                  <div className="message-body">
                    <div className="message-meta">
                      <b>{m.username}</b>

                      <small>{formatLocaleDate(m.createdAt, locale)}</small>
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
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder={t("chat.sendPlaceholder")}
              />

              <button onClick={() => setText((v) => v + " 😂")}>😂</button>

              <button className="send" onClick={sendMessage}>
                {t("common.send")}
              </button>
            </div>

            <div className="call-controls">
              <button className={muted ? "danger" : ""} onClick={toggleMute}>
                {muted ? `🔇 ${t("common.mute")}` : `🎙️ ${t("media.microphone")}`}
              </button>

              <button className={cameraOn ? "active-control" : ""} onClick={toggleCamera}>
                📹 {cameraOn ? t("media.cameraOff") : t("media.camera")}
              </button>

              <button className={screenOn ? "active-control" : ""} onClick={toggleScreen}>
                🖥️ {screenOn ? t("media.stopScreenShare") : t("media.screenShare")}
              </button>

              <button className="disconnect-btn" onClick={() => leaveVoice(true)}>
                ☎ {t("common.endCall")}
              </button>

              <span className="connection">
                ● {connected ? t("connection.online") : t("connection.offline")}
              </span>
            </div>

            {error && (
              <div className="floating-error" onClick={() => setError("")}>
                {error}
              </div>
            )}
          </>
        )}
      </main>

      <aside className="members">
        <div className="members-title">{t("ui.onlineCount", { count: presence.length })}</div>

        {presence.map((p) => {
          const isSelf = p.socketId === socket?.id;

          return (
            <div
              className={`member-card ${
                (
                  isSelf
                    ? localSpeaking && !muted
                    : speakingPeers[p.socketId] && !peerMuted[p.socketId]
                )
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
                  {isSelf ? t("guild.self") : ""}
                </span>
              </div>

              {!isSelf && (
                <div className="peer-audio-controls">
                  <button
                    className={peerMuted[p.socketId] ? "peer-muted" : ""}
                    onClick={() => togglePeerMute(p.socketId)}
                    title={t("media.muteOnlyYou")}
                  >
                    {peerMuted[p.socketId] ? "🔇" : "🔊"}
                  </button>

                  <input
                    type="range"
                    min="0"
                    max="200"
                    value={peerVolumes[p.socketId] ?? 100}
                    onChange={(e) => setPeerVolume(p.socketId, Number(e.target.value))}
                  />

                  <span>
                    {peerMuted[p.socketId] ? "MUTE" : `${peerVolumes[p.socketId] ?? 100}%`}
                  </span>
                </div>
              )}
            </div>
          );
        })}

        <div className="members-title bots">{t("ui.botsCount")}</div>

        <div className="member">
          <div className="avatar bot">{t("bot.name").slice(0, 2).toUpperCase()}</div>

          <div>
            <span>{t("bot.name")}</span>
            <small className="bot-help">{t("bot.helpCommand")}</small>
          </div>
        </div>
      </aside>

      {showAudioSettings && (
        <div className="modal-backdrop">
          <div className="modal audio-settings-modal">
            <h2>{t("media.audioVideoSettings")}</h2>
            <p className="settings-subtitle">{t("media.settingsDescription")}</p>

            <label>{t("media.microphoneInput")}</label>
            <select value={selectedInput} onChange={(e) => switchInput(e.target.value)}>
              <option value="">{t("media.systemDefault")}</option>
              {audioInputs.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Mikrofon ${d.deviceId.slice(0, 6)}`}
                </option>
              ))}
            </select>

            <label>{t("media.speakerOutput")}</label>
            <select value={selectedOutput} onChange={(e) => switchOutput(e.target.value)}>
              <option value="">{t("media.systemDefault")}</option>
              {audioOutputs.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || t("media.speakerFallback", { id: d.deviceId.slice(0, 6) })}
                </option>
              ))}
            </select>

            <div className="settings-divider">{t("media.videoSection")}</div>

            <label>{t("media.cameraInput")}</label>
            <select value={selectedCamera} onChange={(e) => switchCamera(e.target.value)}>
              <option value="">{t("media.systemDefault")}</option>
              {videoInputs.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Kamera ${d.deviceId.slice(0, 6)}`}
                </option>
              ))}
            </select>

            <div className="video-quality-grid">
              <div>
                <label>{t("media.screenQualityLabel")}</label>
                <select
                  value={screenQuality}
                  onChange={(e) => {
                    const value = e.target.value as "720" | "1080";
                    setScreenQuality(value);
                    localStorage.setItem("echoverse_screen_quality", value);
                  }}
                >
                  <option value="720">{t("media.quality", { quality: 720 })}</option>
                  <option value="1080">{t("media.quality", { quality: 1080 })}</option>
                </select>
              </div>
              <div>
                <label>{t("media.fps")}</label>
                <select
                  value={screenFps}
                  onChange={(e) => {
                    const value = Number(e.target.value) as 30 | 60;
                    setScreenFps(value);
                    localStorage.setItem("echoverse_screen_fps", String(value));
                  }}
                >
                  <option value={30}>30 {t("media.fps")}</option>
                  <option value={60}>60 {t("media.fps")}</option>
                </select>
              </div>
            </div>

            <div className="screen-share-note">
              🖥️ {t("media.shareProfile", { quality: screenQuality, fps: screenFps })}
              <small>{t("media.changeNotice")}</small>
            </div>

            <div className="sound-settings-block">
              <label className="sound-toggle-row">
                <span>
                  <b>{t("media.lobbySounds")}</b>
                  <small>{t("media.lobbySoundsDescription")}</small>
                </span>
                <input
                  type="checkbox"
                  checked={lobbySoundsEnabled}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    setLobbySoundsEnabled(enabled);
                    localStorage.setItem("echoverse_lobby_sounds", enabled ? "on" : "off");
                  }}
                />
              </label>

              <label>{t("media.effectVolume", { volume: effectVolume })}</label>
              <input
                type="range"
                min="0"
                max="100"
                value={effectVolume}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  setEffectVolume(value);
                  localStorage.setItem("echoverse_effect_volume", String(value));
                }}
              />
            </div>

            <div className="modal-actions">
              <button onClick={() => setShowAudioSettings(false)}>{t("common.close")}</button>
            </div>
          </div>
        </div>
      )}

      {showFriends && (
        <div className="modal-backdrop">
          <div className="modal friends-modal">
            <div className="friends-header">
              <h2>{t("ui.friends")}</h2>
              <button onClick={() => setShowFriends(false)}>✕</button>
            </div>

            <div className="friend-search-row">
              <input
                value={friendSearch}
                onChange={(e) => setFriendSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchFriends()}
                placeholder={t("friends.searchPlaceholder")}
              />
              <button onClick={searchFriends}>{t("friends.search")}</button>
            </div>

            {friendSearchResults.length > 0 && (
              <div className="friend-section">
                <h3>{t("ui.searchResults")}</h3>
                {friendSearchResults.map((f) => (
                  <div className="friend-row" key={f.id}>
                    <div className="friend-user">
                      <div className="avatar">
                        {f.avatarData ? (
                          <img src={f.avatarData} alt="" />
                        ) : (
                          f.username.slice(0, 2).toUpperCase()
                        )}
                      </div>
                      <b>{f.username}</b>
                    </div>
                    <button onClick={() => sendFriendRequest(f.id)}>＋ {t("friends.add")}</button>
                  </div>
                ))}
              </div>
            )}

            {incomingRequests.length > 0 && (
              <div className="friend-section">
                <h3>{t("ui.incomingRequests")}</h3>
                {incomingRequests.map((f) => (
                  <div className="friend-row" key={f.id}>
                    <div className="friend-user">
                      <div className="avatar">
                        {f.avatarData ? (
                          <img src={f.avatarData} alt="" />
                        ) : (
                          f.username.slice(0, 2).toUpperCase()
                        )}
                      </div>
                      <b>{f.username}</b>
                    </div>
                    <div className="friend-actions">
                      <button onClick={() => respondFriendRequest(f.friendshipId!, true)}>✓</button>
                      <button onClick={() => respondFriendRequest(f.friendshipId!, false)}>
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="friend-section">
              <h3>{t("ui.myFriends")}</h3>
              {friends.length === 0 && <small>{t("ui.noFriends")}</small>}

              {friends.map((f) => (
                <div className="friend-row" key={f.id}>
                  <div className="friend-user">
                    <div className="avatar">
                      {f.avatarData ? (
                        <img src={f.avatarData} alt="" />
                      ) : (
                        f.username.slice(0, 2).toUpperCase()
                      )}
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
              incomingCall.fromUsername.slice(0, 2).toUpperCase()
            )}
          </div>
          <div className="call-info">
            <b>{incomingCall.fromUsername}</b>
            <span>{t("ui.incomingPrivateCall")}</span>
          </div>
          <button className="answer-call" onClick={() => answerIncomingCall(true)}>
            📞
          </button>
          <button className="reject-call" onClick={() => answerIncomingCall(false)}>
            ✕
          </button>
        </div>
      )}

      {privateCallPeer && (
        <div className="private-call-bar">
          <span>
            📞 {privateCallPeer.username}
            {ringing
              ? ` ${t("call.ringing")}`
              : ` ${t("call.privateConversation", { time: formatCallTime(callSeconds) })}`}
          </span>
          <button onClick={() => stopPrivateCall(true)}>{t("common.endCall")}</button>
        </div>
      )}

      {showScreenPicker && (
        <div className="modal-backdrop screen-picker-backdrop">
          <div className="modal screen-picker-modal">
            <div className="screen-picker-header">
              <div>
                <h2>{t("ui.screenShare")}</h2>
                <p>{t("ui.chooseSource")}</p>
              </div>
              <button onClick={() => setShowScreenPicker(false)}>✕</button>
            </div>

            {screenPermission === "denied" && (
              <div className="screen-permission-warning">
                {t("ui.screenPermissionOff")}
                <button onClick={() => window.echoverse?.openScreenSettings?.()}>
                  {t("ui.openSystemSettings")}
                </button>
              </div>
            )}

            <div className="screen-source-grid">
              {screenSources.map((source) => (
                <button
                  className="screen-source-card"
                  key={source.id}
                  onClick={() => beginScreenShare(source)}
                >
                  <div className="screen-source-preview">
                    {source.thumbnail ? <img src={source.thumbnail} alt="" /> : <span>🖥️</span>}
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
            <h2>{t("guild.new")}</h2>

            <input
              autoFocus
              placeholder={t("guild.namePlaceholder")}
              value={newGuildName}
              onChange={(e) => setNewGuildName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createGuild()}
            />

            <div className="modal-actions">
              <button onClick={() => setShowCreate(false)}>{t("guild.cancel")}</button>

              <button className="primary-small" onClick={createGuild}>
                {t("guild.create")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
