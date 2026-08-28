/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import type { Account, FriendUser, Guild, PeerInfo, SpotifyState } from "@echoverse/contracts";
import { useState } from "react";
import { displayInitials } from "./text.js";

export type WorkspaceSidebarLabels = {
  appName: string;
  textChannels: string;
  general: string;
  music: string;
  voiceChannels: string;
  lobby: string;
  self: string;
  muteOnlyYou: string;
  spotifyTogether: string;
  spotifyClientRequired: string;
  spotifyConnect: string;
  spotifyConnected: string;
  spotifyStartParty: string;
  spotifyStopParty: string;
  spotifyFollowing: string;
  spotifyListenTogether: string;
  spotifyLogout: string;
  changeAvatar: string;
  voiceConnected: (version: string) => string;
  microphone: string;
  logout: string;
  createGuild: string;
  directMessages?: string;
  openDms?: string;
  servers?: string;
  close?: string;
  joinVoice?: string;
  invite?: string;
  renameLobby?: string;
  lobbyNamePlaceholder?: string;
  save?: string;
};

type MobileWorkspaceNavigationProps = {
  guilds: Guild[];
  activeGuild: Guild | null;
  activeDmFriend?: FriendUser | null;
  onSelectGuild: (guild: Guild) => void;
  onJoinVoice?: (guild: Guild) => void;
  lobbyName?: string;
  canManageGuild?: boolean;
  onRenameLobby?: (guild: Guild, name: string) => void;
  onOpenDms?: () => void;
  onOpenFriends?: () => void;
  onCreateGuild: () => void;
  brandIconSrc?: string;
  labels: WorkspaceSidebarLabels;
};

function MobileWorkspaceNavigation({
  guilds,
  activeGuild,
  activeDmFriend,
  onSelectGuild,
  onJoinVoice,
  lobbyName,
  canManageGuild,
  onRenameLobby,
  onOpenDms,
  onOpenFriends,
  onCreateGuild,
  brandIconSrc,
  labels
}: MobileWorkspaceNavigationProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const selectGuild = (guild: Guild) => {
    onSelectGuild(guild);
    setMobileMenuOpen(false);
  };
  const openDms = () => {
    onOpenDms?.();
    setMobileMenuOpen(false);
  };
  const openFriends = () => {
    onOpenFriends?.();
    setMobileMenuOpen(false);
  };
  const createGuild = () => {
    onCreateGuild();
    setMobileMenuOpen(false);
  };

  return (
    <>
      <div
        className={`mobile-drawer-backdrop ${mobileMenuOpen ? "open" : ""}`}
        onClick={(event) => {
          if (event.target === event.currentTarget) setMobileMenuOpen(false);
        }}
      >
        <aside className="mobile-drawer" aria-label={labels.appName}>
          <div className="mobile-drawer-header">
            <div className="mobile-brand">
              {brandIconSrc ? (
                <img src={brandIconSrc} alt="" />
              ) : (
                <span>{displayInitials(labels.appName)}</span>
              )}
              <b>{labels.appName}</b>
            </div>
            <button
              className="icon-btn"
              aria-label={labels.close || labels.appName}
              onClick={() => setMobileMenuOpen(false)}
            >
              ✕
            </button>
          </div>

          <div className="mobile-guild-list">
            {guilds.map((guild) => (
              <button
                key={guild.id}
                className={`mobile-guild-row ${activeGuild?.id === guild.id ? "active" : ""}`}
                onClick={() => selectGuild(guild)}
              >
                <span className="mobile-guild-icon">{displayInitials(guild.name)}</span>
                <span>{guild.name}</span>
                {guild.id === "echoverse" && <small>⌂</small>}
              </button>
            ))}
          </div>

          {activeGuild && (
            <div className="mobile-channel-list">
              <div className="mobile-channel-heading">{activeGuild.name}</div>
              <button className="mobile-channel-row active"># {labels.general}</button>
              <button className="mobile-channel-row"># {labels.music}</button>
              <button
                className="mobile-channel-row voice"
                onClick={() => {
                  onJoinVoice?.(activeGuild);
                  setMobileMenuOpen(false);
                }}
              >
                🔊 {lobbyName || labels.lobby}
              </button>
              {canManageGuild && onRenameLobby && (
                <LobbyNameEditor
                  key={`mobile:${activeGuild.id}:${lobbyName || labels.lobby}`}
                  value={lobbyName || labels.lobby}
                  renameLabel={labels.renameLobby || "Rename lobby"}
                  placeholder={labels.lobbyNamePlaceholder || labels.lobby}
                  saveLabel={labels.save || "Save"}
                  onSave={(name) => onRenameLobby(activeGuild, name)}
                />
              )}
            </div>
          )}

          <button className="mobile-action-row" onClick={openDms}>
            ✉ <span>{labels.directMessages || "DM"}</span>
          </button>
          <button className="mobile-action-row" onClick={openFriends}>
            👥 <span>{labels.openDms || labels.directMessages || "Friends"}</span>
          </button>
          <button className="mobile-action-row add" onClick={createGuild}>
            ＋ <span>{labels.createGuild}</span>
          </button>
        </aside>
      </div>

      <nav className="mobile-nav" aria-label={labels.appName}>
        <button onClick={() => setMobileMenuOpen(true)}>
          ☰ <span>{labels.servers || labels.textChannels}</span>
        </button>
        <button onClick={openDms}>
          ✉ <span>{labels.directMessages || "DM"}</span>
        </button>
        <button onClick={openFriends}>
          👥 <span>{labels.openDms || "Friends"}</span>
        </button>
        <button
          onClick={() => activeGuild && onJoinVoice?.(activeGuild)}
          disabled={!activeGuild || !onJoinVoice}
        >
          🔊 <span>{labels.joinVoice || labels.lobby}</span>
        </button>
      </nav>
    </>
  );
}

function LobbyNameEditor({
  value,
  renameLabel,
  placeholder,
  saveLabel,
  onSave
}: {
  value: string;
  renameLabel: string;
  placeholder: string;
  saveLabel: string;
  onSave: (name: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  return (
    <form
      className="lobby-name-editor"
      aria-label={renameLabel}
      onSubmit={(event) => {
        event.preventDefault();
        const name = draft.trim();
        if (name && name !== value) onSave(name);
      }}
    >
      <input
        value={draft}
        maxLength={32}
        aria-label={placeholder}
        placeholder={placeholder}
        onChange={(event) => setDraft(event.target.value)}
      />
      <button type="submit" disabled={!draft.trim() || draft.trim() === value}>
        {saveLabel}
      </button>
    </form>
  );
}

/** Shared server/channel/profile sidebar; commands and platform state stay in the renderer. */
export function WorkspaceSidebar({
  guilds,
  activeGuild,
  presence,
  socketId,
  localSpeaking,
  muted,
  speakingPeers,
  peerMuted,
  peerVolumes,
  spotifyConfigured,
  spotifyConnected,
  spotifyName,
  spotifyParty,
  spotifyLeader,
  spotifyFollowing,
  spotifyMessage,
  account,
  username,
  appVersion,
  labels,
  onSelectGuild,
  onJoinVoice,
  lobbyName,
  canManageGuild,
  onRenameLobby,
  activeDmFriend,
  onOpenDms,
  onOpenFriends,
  brandIconSrc,
  onCreateInvite,
  onCreateGuild,
  onTogglePeerMute,
  onPeerVolumeChange,
  onSpotifyLogin,
  onStartSpotifyParty,
  onStopSpotifyParty,
  onFollowSpotifyParty,
  onSpotifyLogout,
  onChangeAvatar,
  onToggleMute,
  onLogout
}: {
  guilds: Guild[];
  activeGuild: Guild | null;
  presence: PeerInfo[];
  socketId?: string;
  localSpeaking: boolean;
  muted: boolean;
  speakingPeers: Record<string, boolean>;
  peerMuted: Record<string, boolean>;
  peerVolumes: Record<string, number>;
  spotifyConfigured: boolean;
  spotifyConnected: boolean;
  spotifyName: string;
  spotifyParty: SpotifyState | null;
  spotifyLeader: boolean;
  spotifyFollowing: boolean;
  spotifyMessage: string;
  account: Account | null;
  username: string;
  appVersion: string;
  labels: WorkspaceSidebarLabels;
  onSelectGuild: (guild: Guild) => void;
  onJoinVoice?: (guild: Guild) => void;
  lobbyName?: string;
  canManageGuild?: boolean;
  onRenameLobby?: (guild: Guild, name: string) => void;
  activeDmFriend?: FriendUser | null;
  onOpenDms?: () => void;
  onOpenFriends?: () => void;
  brandIconSrc?: string;
  onCreateInvite?: (guild: Guild) => void;
  onCreateGuild: () => void;
  onTogglePeerMute: (socketId: string) => void;
  onPeerVolumeChange: (socketId: string, volume: number) => void;
  onSpotifyLogin: () => void;
  onStartSpotifyParty: () => void;
  onStopSpotifyParty: () => void;
  onFollowSpotifyParty: () => void;
  onSpotifyLogout: () => void;
  onChangeAvatar: (file?: File) => void;
  onToggleMute: () => void;
  onLogout: () => void;
}) {
  return (
    <>
      <aside className="servers">
        <div className="server-logo">
          {brandIconSrc ? (
            <img src={brandIconSrc} alt={labels.appName} />
          ) : (
            displayInitials(labels.appName)
          )}
        </div>

        {guilds.map((guild) => (
          <button
            key={guild.id}
            title={`${guild.name} • ${guild.id}`}
            className={`server-circle ${activeGuild?.id === guild.id ? "active" : ""}`}
            onClick={() => onSelectGuild(guild)}
          >
            {displayInitials(guild.name)}
          </button>
        ))}

        <button
          className={`server-circle dm ${activeDmFriend ? "active" : ""}`}
          aria-label={labels.directMessages || "Direct messages"}
          title={labels.directMessages || "Direct messages"}
          onClick={onOpenDms}
        >
          ✉
        </button>

        <button
          className="server-circle add"
          aria-label={labels.createGuild}
          onClick={onCreateGuild}
        >
          +
        </button>
      </aside>

      <aside className="channels">
        <div className="guild-title">
          <span>{activeGuild?.name}</span>
          <small className="guild-code">
            {activeGuild
              ? `#${activeGuild.id}${activeGuild.role ? ` · ${activeGuild.role}` : ""}`
              : ""}
          </small>
          {activeGuild &&
            onCreateInvite &&
            (activeGuild.role === "owner" || activeGuild.role === "admin") && (
              <button className="guild-invite-button" onClick={() => onCreateInvite(activeGuild)}>
                + {labels.invite || "Invite"}
              </button>
            )}
        </div>

        <div className="channel-group">
          <div className="channel-title">{labels.textChannels}</div>
          <button className="channel active"># {labels.general}</button>
          <button className="channel"># {labels.music}</button>
        </div>

        <div className="channel-group">
          <div className="channel-title">{labels.voiceChannels}</div>
          <button
            className={`channel voice ${onJoinVoice ? "" : "active"}`}
            disabled={!activeGuild || !onJoinVoice}
            onClick={() => activeGuild && onJoinVoice?.(activeGuild)}
          >
            🔊 {lobbyName || labels.lobby}
            {!activeGuild ? " · " : ""}
            {activeGuild && labels.joinVoice ? labels.joinVoice : ""}
          </button>

          {activeGuild && canManageGuild && onRenameLobby && (
            <LobbyNameEditor
              key={`${activeGuild.id}:${lobbyName || labels.lobby}`}
              value={lobbyName || labels.lobby}
              renameLabel={labels.renameLobby || "Rename lobby"}
              placeholder={labels.lobbyNamePlaceholder || labels.lobby}
              saveLabel={labels.save || "Save"}
              onSave={(name) => onRenameLobby(activeGuild, name)}
            />
          )}

          <div className="voice-users">
            {presence.map((peer) => {
              const isSelf = peer.socketId === socketId;
              const speaking = isSelf
                ? localSpeaking && !muted
                : !!speakingPeers[peer.socketId] && !peerMuted[peer.socketId];

              return (
                <div className={`voice-user-row ${speaking ? "speaking" : ""}`} key={peer.socketId}>
                  <div className="voice-user">
                    {peer.avatarData ? (
                      <img className="voice-avatar" src={peer.avatarData} alt="" />
                    ) : (
                      <span className="mini-dot" />
                    )}
                    {peer.username}
                    {isSelf ? labels.self : ""}
                  </div>

                  {!isSelf && (
                    <div className="voice-peer-controls">
                      <button
                        className={peerMuted[peer.socketId] ? "peer-muted" : ""}
                        aria-label={labels.muteOnlyYou}
                        title={labels.muteOnlyYou}
                        onClick={() => onTogglePeerMute(peer.socketId)}
                      >
                        {peerMuted[peer.socketId] ? "🔇" : "🔊"}
                      </button>
                      <input
                        type="range"
                        min="0"
                        max="200"
                        value={peerVolumes[peer.socketId] ?? 100}
                        aria-label={peer.username}
                        onChange={(event) =>
                          onPeerVolumeChange(peer.socketId, Number(event.target.value))
                        }
                      />
                      <span>
                        {peerMuted[peer.socketId] ? "M" : `${peerVolumes[peer.socketId] ?? 100}%`}
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
            <b>{labels.spotifyTogether}</b>
            <span className="spotify-dot" />
          </div>

          {!spotifyConfigured ? (
            <small>{labels.spotifyClientRequired}</small>
          ) : !spotifyConnected ? (
            <button className="spotify-connect" onClick={onSpotifyLogin}>
              {labels.spotifyConnect}
            </button>
          ) : (
            <>
              <small>{spotifyName || labels.spotifyConnected}</small>

              {spotifyParty?.active && (
                <div className="spotify-now">
                  {spotifyParty.albumImage && <img src={spotifyParty.albumImage} alt="" />}
                  <div>
                    <b>{spotifyParty.trackName || labels.spotifyTogether}</b>
                    <small>{spotifyParty.artistName || spotifyParty.leaderUsername}</small>
                  </div>
                </div>
              )}

              {!spotifyParty?.active ? (
                <button className="spotify-action" onClick={onStartSpotifyParty}>
                  ▶ {labels.spotifyStartParty}
                </button>
              ) : spotifyLeader ? (
                <button className="spotify-stop" onClick={onStopSpotifyParty}>
                  ■ {labels.spotifyStopParty}
                </button>
              ) : (
                <button
                  className={spotifyFollowing ? "spotify-following" : "spotify-action"}
                  onClick={onFollowSpotifyParty}
                >
                  {spotifyFollowing
                    ? `✓ ${labels.spotifyFollowing}`
                    : `🎧 ${labels.spotifyListenTogether}`}
                </button>
              )}

              <button className="spotify-logout" onClick={onSpotifyLogout}>
                {labels.spotifyLogout}
              </button>
            </>
          )}

          {spotifyMessage && <div className="spotify-message">{spotifyMessage}</div>}
        </div>

        <div className="user-panel">
          <label className="user-avatar avatar-upload-label" title={labels.changeAvatar}>
            {account?.avatarData ? (
              <img src={account.avatarData} alt="" />
            ) : (
              displayInitials(username)
            )}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              onChange={(event) => {
                onChangeAvatar(event.target.files?.[0]);
                event.currentTarget.value = "";
              }}
            />
          </label>

          <div className="user-info">
            <b>{username}</b>
            <small>{labels.voiceConnected(appVersion)}</small>
          </div>

          <button aria-label={labels.microphone} onClick={onToggleMute} title={labels.microphone}>
            {muted ? "🔇" : "🎙️"}
          </button>
          <button aria-label={labels.logout} onClick={onLogout} title={labels.logout}>
            ↪
          </button>
        </div>
      </aside>

      <MobileWorkspaceNavigation
        guilds={guilds}
        activeGuild={activeGuild}
        activeDmFriend={activeDmFriend}
        onSelectGuild={onSelectGuild}
        onJoinVoice={onJoinVoice}
        lobbyName={lobbyName}
        canManageGuild={canManageGuild}
        onRenameLobby={onRenameLobby}
        onOpenDms={onOpenDms}
        onOpenFriends={onOpenFriends}
        onCreateGuild={onCreateGuild}
        brandIconSrc={brandIconSrc}
        labels={labels}
      />
    </>
  );
}
