/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import type { Account, Guild, PeerInfo, SpotifyState } from "@echoverse/contracts";
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
};

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
        <div className="server-logo">{displayInitials(labels.appName)}</div>

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
          <small className="guild-code">{activeGuild ? `#${activeGuild.id}` : ""}</small>
        </div>

        <div className="channel-group">
          <div className="channel-title">{labels.textChannels}</div>
          <button className="channel active"># {labels.general}</button>
          <button className="channel"># {labels.music}</button>
        </div>

        <div className="channel-group">
          <div className="channel-title">{labels.voiceChannels}</div>
          <button className="channel voice active">🔊 {labels.lobby}</button>

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
    </>
  );
}
