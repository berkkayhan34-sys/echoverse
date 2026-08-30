/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import type {
  Account,
  FriendUser,
  Guild,
  GuildCategory,
  GuildChannel,
  PeerInfo
} from "@echoverse/contracts";
import { useEffect, useState } from "react";
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
  changeAvatar: string;
  voiceConnected: (version: string) => string;
  microphone: string;
  logout: string;
  createGuild: string;
  joinGuild?: string;
  directMessages?: string;
  openDms?: string;
  servers?: string;
  close?: string;
  joinVoice?: string;
  invite?: string;
  leaveGuild?: string;
  deleteGuild?: string;
  moreOptions: string;
  renameLobby?: string;
  lobbyNamePlaceholder?: string;
  save?: string;
  cancel?: string;
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
  onJoinGuild?: () => void;
  onLeaveGuild?: (guild: Guild) => void;
  onDeleteGuild?: (guild: Guild) => void;
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
  onJoinGuild,
  onLeaveGuild,
  onDeleteGuild,
  brandIconSrc,
  labels
}: MobileWorkspaceNavigationProps) {
  const [openGuildMenu, setOpenGuildMenu] = useState<string | null>(null);
  const [serverActionsOpen, setServerActionsOpen] = useState(false);
  // Start with the server/channel navigator visible so mobile users land in
  // the same context-rich workspace as desktop users.
  const [mobileMenuOpen, setMobileMenuOpen] = useState(true);
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
    setServerActionsOpen(false);
    setMobileMenuOpen(false);
  };
  const joinGuild = () => {
    onJoinGuild?.();
    setServerActionsOpen(false);
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
              <div className="mobile-guild-entry" key={guild.id}>
                <button
                  className={`mobile-guild-row ${activeGuild?.id === guild.id ? "active" : ""}`}
                  onClick={() => selectGuild(guild)}
                >
                  <span className="mobile-guild-icon">{displayInitials(guild.name)}</span>
                  <span>{guild.name}</span>
                  {guild.id === "echoverse" && <small>⌂</small>}
                </button>
                {((onLeaveGuild && guild.id !== "echoverse" && guild.role !== "owner") ||
                  (onDeleteGuild && guild.id !== "echoverse" && guild.role === "owner")) && (
                  <div className="guild-options">
                    <button
                      className="guild-options-trigger"
                      aria-label={`${labels.moreOptions}: ${guild.name}`}
                      aria-haspopup="menu"
                      aria-expanded={openGuildMenu === guild.id}
                      title={labels.moreOptions}
                      onClick={(event) => {
                        event.stopPropagation();
                        setOpenGuildMenu((current) => (current === guild.id ? null : guild.id));
                      }}
                    >
                      ⋯
                    </button>
                    {openGuildMenu === guild.id && (
                      <div className="guild-options-menu" role="menu">
                        {guild.role === "owner" && onDeleteGuild ? (
                          <button
                            role="menuitem"
                            className="guild-leave-action"
                            onClick={() => {
                              setOpenGuildMenu(null);
                              onDeleteGuild(guild);
                            }}
                          >
                            {labels.deleteGuild}
                          </button>
                        ) : onLeaveGuild ? (
                          <button
                            role="menuitem"
                            className="guild-leave-action"
                            onClick={() => {
                              setOpenGuildMenu(null);
                              onLeaveGuild(guild);
                            }}
                          >
                            {labels.leaveGuild}
                          </button>
                        ) : null}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {activeGuild && (
            <div className="mobile-channel-list">
              <div className="mobile-channel-heading">{activeGuild.name}</div>
              <button className="mobile-channel-row active"># {labels.general}</button>
              <button className="mobile-channel-row"># {labels.music}</button>
              <div className="mobile-lobby-channel-row">
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
                    cancelLabel={labels.cancel || "Cancel"}
                    onSave={(name) => onRenameLobby(activeGuild, name)}
                  />
                )}
              </div>
            </div>
          )}

          <button className="mobile-action-row" onClick={openDms}>
            ✉ <span>{labels.directMessages || "DM"}</span>
          </button>
          <button className="mobile-action-row" onClick={openFriends}>
            👥 <span>{labels.openDms || labels.directMessages || "Friends"}</span>
          </button>
          <div className="mobile-server-actions">
            <button
              className="mobile-action-row add"
              aria-expanded={serverActionsOpen}
              aria-haspopup="menu"
              onClick={() => setServerActionsOpen((open) => !open)}
            >
              ＋ <span>{labels.createGuild}</span>
            </button>
            {serverActionsOpen && (
              <div className="server-add-menu" role="menu">
                <button role="menuitem" onClick={createGuild}>
                  ＋ {labels.createGuild}
                </button>
                {onJoinGuild && (
                  <button role="menuitem" onClick={joinGuild}>
                    ↗ {labels.joinGuild || "Join server"}
                  </button>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>

      <nav className="mobile-nav" aria-label={labels.appName}>
        <button
          className={!activeDmFriend && activeGuild ? "active" : ""}
          aria-current={!activeDmFriend && activeGuild ? "page" : undefined}
          onClick={() => setMobileMenuOpen(true)}
        >
          ☰ <span>{labels.servers || labels.textChannels}</span>
        </button>
        <button
          className={activeDmFriend ? "active" : ""}
          aria-current={activeDmFriend ? "page" : undefined}
          onClick={openDms}
        >
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
  cancelLabel,
  onSave
}: {
  value: string;
  renameLabel: string;
  placeholder: string;
  saveLabel: string;
  cancelLabel: string;
  onSave: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);
  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  if (!editing) {
    return (
      <button
        type="button"
        className="lobby-edit-trigger"
        aria-label={renameLabel}
        title={renameLabel}
        onClick={() => setEditing(true)}
      >
        ✎
      </button>
    );
  }

  return (
    <form
      className="lobby-name-editor"
      aria-label={renameLabel}
      onSubmit={(event) => {
        event.preventDefault();
        const name = draft.trim();
        if (name && name !== value) {
          onSave(name);
          setEditing(false);
        }
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
      <button type="button" onClick={cancel}>
        {cancelLabel}
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
  onJoinGuild,
  onLeaveGuild,
  onDeleteGuild,
  onTogglePeerMute,
  onPeerVolumeChange,
  onChangeAvatar,
  onToggleMute,
  onLogout,
  channels,
  categories,
  onSelectChannel
}: {
  guilds: Guild[];
  channels?: GuildChannel[];
  categories?: GuildCategory[];
  activeGuild: Guild | null;
  presence: PeerInfo[];
  socketId?: string;
  localSpeaking: boolean;
  muted: boolean;
  speakingPeers: Record<string, boolean>;
  peerMuted: Record<string, boolean>;
  peerVolumes: Record<string, number>;
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
  onJoinGuild?: () => void;
  onLeaveGuild?: (guild: Guild) => void;
  onDeleteGuild?: (guild: Guild) => void;
  onTogglePeerMute: (socketId: string) => void;
  onPeerVolumeChange: (socketId: string, volume: number) => void;
  onChangeAvatar: (file?: File) => void;
  onToggleMute: () => void;
  onLogout: () => void;
  onSelectChannel?: (channel: GuildChannel) => void;
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
          <div className="server-entry" key={guild.id}>
            <button
              title={`${guild.name} • ${guild.id}`}
              className={`server-circle ${activeGuild?.id === guild.id ? "active" : ""}`}
              onClick={() => onSelectGuild(guild)}
            >
              {displayInitials(guild.name)}
            </button>
            {((onLeaveGuild && guild.id !== "echoverse" && guild.role !== "owner") ||
              (onDeleteGuild && guild.id !== "echoverse" && guild.role === "owner")) && (
              <details className="guild-options">
                <summary
                  className="guild-options-trigger"
                  aria-label={`${labels.moreOptions}: ${guild.name}`}
                  aria-haspopup="menu"
                  title={labels.moreOptions}
                >
                  ⋯
                </summary>
                <div className="guild-options-menu" role="menu">
                  {guild.role === "owner" && onDeleteGuild ? (
                    <button
                      role="menuitem"
                      className="guild-leave-action"
                      onClick={(event) => {
                        event.currentTarget.closest("details")?.removeAttribute("open");
                        onDeleteGuild(guild);
                      }}
                    >
                      {labels.deleteGuild}
                    </button>
                  ) : onLeaveGuild ? (
                    <button
                      role="menuitem"
                      className="guild-leave-action"
                      onClick={(event) => {
                        event.currentTarget.closest("details")?.removeAttribute("open");
                        onLeaveGuild(guild);
                      }}
                    >
                      {labels.leaveGuild}
                    </button>
                  ) : null}
                </div>
              </details>
            )}
          </div>
        ))}

        <button
          className={`server-circle dm ${activeDmFriend ? "active" : ""}`}
          aria-label={labels.directMessages || "Direct messages"}
          title={labels.directMessages || "Direct messages"}
          onClick={onOpenDms}
        >
          ✉
        </button>

        <details className="server-add-details">
          <summary
            className="server-circle add"
            aria-label={labels.createGuild}
            title={labels.createGuild}
            aria-haspopup="menu"
          >
            +
          </summary>
          <div className="server-add-menu" role="menu">
            <button
              role="menuitem"
              aria-label={labels.createGuild}
              onClick={(event) => {
                event?.currentTarget?.closest("details")?.removeAttribute("open");
                onCreateGuild();
              }}
            >
              ＋ {labels.createGuild}
            </button>
            {onJoinGuild && (
              <button
                role="menuitem"
                onClick={(event) => {
                  event?.currentTarget?.closest("details")?.removeAttribute("open");
                  onJoinGuild();
                }}
              >
                ↗ {labels.joinGuild || "Join server"}
              </button>
            )}
          </div>
        </details>
      </aside>

      <aside className="channels">
        <div className="guild-title">
          <div className="guild-heading-copy">
            <span>{activeGuild?.name}</span>
            <small className="guild-code">
              {activeGuild
                ? `#${activeGuild.id}${activeGuild.role ? ` · ${activeGuild.role}` : ""}`
                : ""}
            </small>
          </div>
          {activeGuild &&
            onCreateInvite &&
            (activeGuild.role === "owner" || activeGuild.role === "admin") && (
              <button className="guild-invite-button" onClick={() => onCreateInvite(activeGuild)}>
                <span aria-hidden="true">↗</span>
                <span>{labels.invite}</span>
              </button>
            )}
          {activeGuild &&
            onDeleteGuild &&
            activeGuild.id !== "echoverse" &&
            activeGuild.role === "owner" && (
              <button
                className="guild-delete-button"
                type="button"
                onClick={() => onDeleteGuild(activeGuild)}
              >
                {labels.deleteGuild}
              </button>
            )}
        </div>

        <div className="channel-group">
          <div className="channel-title">{labels.textChannels}</div>
          {categories
            ?.filter((category) => !category.archived)
            .map((category) => (
              <div className="channel-category-label" key={category.id}>
                {category.name}
              </div>
            ))}
          {(channels?.length
            ? channels.filter((channel) => channel.type === "text")
            : [{ id: "legacy-general", name: labels.general, type: "text" as const }]
          ).map((channel, index) => (
            <button
              key={channel.id}
              className={`channel ${index === 0 ? "active" : ""}`}
              onClick={() => onSelectChannel?.(channel as GuildChannel)}
            >
              # {channel.name}
            </button>
          ))}
        </div>

        <div className="channel-group">
          <div className="channel-title">{labels.voiceChannels}</div>
          {(channels?.length
            ? channels.filter((channel) => ["voice", "stage"].includes(channel.type))
            : [{ id: "legacy-lobby", name: lobbyName || labels.lobby, type: "voice" as const }]
          ).map((channel) => (
            <div className="lobby-channel-row" key={channel.id}>
              <button
                className={`channel voice ${onJoinVoice ? "" : "active"}`}
                disabled={!activeGuild || !onJoinVoice}
                onClick={() => {
                  if (activeGuild) {
                    onSelectChannel?.(channel as GuildChannel);
                    onJoinVoice?.(activeGuild);
                  }
                }}
              >
                🔊 {channel.name}
              </button>
              {activeGuild &&
                channel.type === "voice" &&
                channel.id.endsWith(":lobby") &&
                canManageGuild &&
                onRenameLobby && (
                  <LobbyNameEditor
                    key={`${activeGuild.id}:${lobbyName || labels.lobby}`}
                    value={lobbyName || labels.lobby}
                    renameLabel={labels.renameLobby || "Rename lobby"}
                    placeholder={labels.lobbyNamePlaceholder || labels.lobby}
                    saveLabel={labels.save || "Save"}
                    cancelLabel={labels.cancel || "Cancel"}
                    onSave={(name) => onRenameLobby(activeGuild, name)}
                  />
                )}
            </div>
          ))}

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
        onJoinGuild={onJoinGuild}
        onLeaveGuild={onLeaveGuild}
        onDeleteGuild={onDeleteGuild}
        brandIconSrc={brandIconSrc}
        labels={labels}
      />
    </>
  );
}
