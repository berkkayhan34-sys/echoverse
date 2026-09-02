/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import type {
  Account,
  DmConversation,
  DmPeerPreference,
  FriendUser,
  Guild,
  GuildCategory,
  GuildChannel,
  GuildChannelType,
  GuildMember,
  PeerInfo,
  GuildNotificationLevel
} from "@echoverse/contracts";
import { useEffect, useState } from "react";
import { displayInitials } from "./text.js";
import { GuildStructurePanel, type GuildStructureLabels } from "./guild-structure.js";
import type { DirectMessageInboxLabels } from "./dm-inbox.js";

type ChannelGlyphKind = "text" | "voice" | "dm";

function ChannelGlyph({ kind }: { kind: ChannelGlyphKind }) {
  if (kind === "text") {
    return (
      <svg className="channel-glyph" aria-hidden="true" viewBox="0 0 24 24" fill="none">
        <path d="M9 4 7 20M17 4l-2 16M4 9h16M3 15h16" />
      </svg>
    );
  }

  if (kind === "voice") {
    return (
      <svg className="channel-glyph" aria-hidden="true" viewBox="0 0 24 24" fill="none">
        <path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4" />
      </svg>
    );
  }

  return (
    <svg className="channel-glyph" aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 3v-3.06A2.5 2.5 0 0 1 4 13.5v-7Z" />
      <path d="M8 8.5h8M8 12h5" />
    </svg>
  );
}

function NotificationGlyph({ muted }: { muted: boolean }) {
  return (
    <svg className="channel-notification-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none">
      {muted ? (
        <path d="m5 5 14 14M9.5 5.8A5 5 0 0 1 17 10v3l2 2H8M6 15h12M10 19h4" />
      ) : (
        <path d="M7 15h10l-1.5-2V9a3.5 3.5 0 0 0-7 0v4L7 15ZM10 18h4" />
      )}
    </svg>
  );
}

type WorkspaceGlyphName = "settings" | "microphone" | "muted" | "logout";

function WorkspaceGlyph({ name }: { name: WorkspaceGlyphName }) {
  const path = {
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="m19 12 2-1-2-3-2 1a7 7 0 0 0-2-1l-.3-2h-3.4L11 8a7 7 0 0 0-2 1L7 8l-2 3 2 1a7 7 0 0 0 0 2l-2 1 2 3 2-1a7 7 0 0 0 2 1l.3 2h3.4l.3-2a7 7 0 0 0 2-1l2 1 2-3-2-1a7 7 0 0 0 0-2Z" />
      </>
    ),
    microphone: (
      <>
        <rect x="8" y="3" width="8" height="12" rx="4" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" />
      </>
    ),
    muted: (
      <>
        <rect x="8" y="3" width="8" height="12" rx="4" />
        <path d="M5 11a7 7 0 0 0 14 0M4 4l16 16M12 18v3M9 21h6" />
      </>
    ),
    logout: <path d="M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4M14 8l4 4-4 4M9 12h9" />
  }[name];

  return (
    <svg className="workspace-glyph" aria-hidden="true" viewBox="0 0 24 24" fill="none">
      {path}
    </svg>
  );
}

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
  settings?: string;
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
  muteChannel?: string;
  unmuteChannel?: string;
  unread?: string;
  manageChannels?: string;
  structure?: GuildStructureLabels;
  dmInbox?: DirectMessageInboxLabels;
};

type MobileWorkspaceNavigationProps = {
  guilds: Guild[];
  activeGuild: Guild | null;
  activeDmFriend?: FriendUser | null;
  activeChannelId?: string;
  onSelectGuild: (guild: Guild) => void;
  onSelectChannel?: (channel: GuildChannel) => void;
  onJoinVoice?: (guild: Guild) => void;
  lobbyName?: string;
  canManageGuild?: boolean;
  onRenameLobby?: (guild: Guild, name: string) => void;
  onOpenDms?: () => void;
  onOpenFriends?: () => void;
  onOpenSettings?: () => void;
  onCreateGuild: () => void;
  onJoinGuild?: () => void;
  onLeaveGuild?: (guild: Guild) => void;
  onDeleteGuild?: (guild: Guild) => void;
  channels?: GuildChannel[];
  categories?: GuildCategory[];
  guildMembers?: GuildMember[];
  onCreateCategory?: (name: string) => void;
  onUpdateCategory?: (categoryId: string, updates: { name?: string; archived?: boolean }) => void;
  onCreateChannel?: (name: string, type: GuildChannelType, categoryId?: string | null) => void;
  onUpdateChannel?: (channelId: string, updates: { name?: string; archived?: boolean }) => void;
  onRoleChange?: (accountId: string, role: Exclude<GuildMember["role"], "owner">) => void;
  notificationUnread?: Record<string, number>;
  notificationLevels?: Record<string, GuildNotificationLevel>;
  onSetNotificationLevel?: (channelId: string, level: GuildNotificationLevel) => void;
  onMarkChannelRead?: (channelId: string) => void;
  brandIconSrc?: string;
  labels: WorkspaceSidebarLabels;
};

function MobileWorkspaceNavigation({
  guilds,
  activeGuild,
  activeDmFriend,
  activeChannelId,
  onSelectGuild,
  onSelectChannel,
  onJoinVoice,
  lobbyName,
  canManageGuild,
  onRenameLobby,
  onOpenDms,
  onOpenFriends,
  onOpenSettings,
  onCreateGuild,
  onJoinGuild,
  onLeaveGuild,
  onDeleteGuild,
  channels,
  categories,
  guildMembers,
  onCreateCategory,
  onUpdateCategory,
  onCreateChannel,
  onUpdateChannel,
  onRoleChange,
  notificationUnread = {},
  notificationLevels = {},
  onSetNotificationLevel,
  onMarkChannelRead,
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
  const openSettings = () => {
    onOpenSettings?.();
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
  const visibleTextChannels = (channels || []).filter(
    (channel) => channel.type === "text" && !channel.archived
  );
  const visibleVoiceChannels = (channels || []).filter(
    (channel) => ["voice", "stage"].includes(channel.type) && !channel.archived
  );
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
              {(visibleTextChannels.length
                ? visibleTextChannels
                : [
                    {
                      id: `${activeGuild.id}:general`,
                      guildId: activeGuild.id,
                      name: labels.general,
                      type: "text" as const,
                      position: 0,
                      archived: false,
                      createdAt: ""
                    }
                  ]
              ).map((channel) => (
                <div className="mobile-channel-row-wrapper" key={channel.id}>
                  <button
                    className={`mobile-channel-row ${activeChannelId === channel.id ? "active" : ""}`}
                    onClick={() => {
                      onSelectChannel?.(channel as GuildChannel);
                      onMarkChannelRead?.(channel.id);
                      setMobileMenuOpen(false);
                    }}
                  >
                    <span>
                      <ChannelGlyph kind="text" />
                      <span className="sr-only"># {channel.name}</span>
                      <span className="channel-label">{channel.name}</span>
                    </span>
                    {(notificationUnread[channel.id] || 0) > 0 && (
                      <span
                        className="channel-unread-badge"
                        aria-label={`${notificationUnread[channel.id]} ${labels.unread || "unread"}`}
                      >
                        {(notificationUnread[channel.id] || 0) > 99
                          ? "99+"
                          : notificationUnread[channel.id]}
                      </span>
                    )}
                  </button>
                  {onSetNotificationLevel && (
                    <button
                      type="button"
                      className="channel-notification-toggle"
                      aria-label={
                        notificationLevels[channel.id] === "none"
                          ? labels.unmuteChannel || "Unmute channel notifications"
                          : labels.muteChannel || "Mute channel notifications"
                      }
                      aria-pressed={notificationLevels[channel.id] === "none"}
                      onClick={(event) => {
                        event.stopPropagation();
                        onSetNotificationLevel(
                          channel.id,
                          notificationLevels[channel.id] === "none" ? "all" : "none"
                        );
                      }}
                    >
                      <NotificationGlyph muted={notificationLevels[channel.id] === "none"} />
                    </button>
                  )}
                </div>
              ))}
              {(visibleVoiceChannels.length
                ? visibleVoiceChannels
                : [
                    {
                      id: `${activeGuild.id}:lobby`,
                      guildId: activeGuild.id,
                      name: lobbyName || labels.lobby,
                      type: "voice" as const,
                      position: 0,
                      archived: false,
                      createdAt: ""
                    }
                  ]
              ).map((channel) => (
                <div className="mobile-lobby-channel-row" key={channel.id}>
                  <button
                    className="mobile-channel-row voice"
                    onClick={() => {
                      onSelectChannel?.(channel as GuildChannel);
                      onJoinVoice?.(activeGuild);
                      setMobileMenuOpen(false);
                    }}
                  >
                    <span>
                      <ChannelGlyph kind="voice" />
                      <span className="channel-label">{channel.name}</span>
                    </span>
                  </button>
                  {canManageGuild && onRenameLobby && channel.id.endsWith(":lobby") && (
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
              ))}
            </div>
          )}

          {activeGuild &&
            labels.structure &&
            onCreateCategory &&
            onUpdateCategory &&
            onCreateChannel &&
            onUpdateChannel &&
            onRoleChange &&
            (activeGuild.role === "owner" || activeGuild.role === "admin") && (
              <details className="guild-structure-details mobile-guild-structure-details">
                <summary className="mobile-action-row guild-manage-button">
                  ⚙︎ <span>{labels.manageChannels || labels.structure.title}</span>
                </summary>
                <GuildStructurePanel
                  channels={channels || []}
                  categories={categories || []}
                  members={guildMembers || []}
                  labels={labels.structure}
                  canManage
                  onClose={() => {
                    document.activeElement?.closest("details")?.removeAttribute("open");
                  }}
                  onCreateCategory={onCreateCategory}
                  onUpdateCategory={onUpdateCategory}
                  onCreateChannel={onCreateChannel}
                  onUpdateChannel={onUpdateChannel}
                  onRoleChange={onRoleChange}
                />
              </details>
            )}

          <button className="mobile-action-row" onClick={openDms}>
            <ChannelGlyph kind="dm" /> <span>{labels.directMessages || "DM"}</span>
          </button>
          <button className="mobile-action-row" onClick={openFriends}>
            ♙ <span>{labels.openDms || labels.directMessages || "Friends"}</span>
          </button>
          {onOpenSettings && (
            <button className="mobile-action-row" onClick={openSettings}>
              ⚙︎ <span>{labels.settings || "Settings"}</span>
            </button>
          )}
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
          <ChannelGlyph kind="dm" /> <span>{labels.directMessages || "DM"}</span>
        </button>
        <button onClick={openFriends}>
          ♙ <span>{labels.openDms || "Friends"}</span>
        </button>
        <button
          onClick={() => activeGuild && onJoinVoice?.(activeGuild)}
          disabled={!activeGuild || !onJoinVoice}
        >
          <ChannelGlyph kind="voice" /> <span>{labels.joinVoice || labels.lobby}</span>
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
  activeChannelId,
  labels,
  onSelectGuild,
  onJoinVoice,
  lobbyName,
  canManageGuild,
  onRenameLobby,
  activeDmFriend,
  onOpenDms,
  onOpenFriends,
  onOpenSettings,
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
  onSelectChannel,
  notificationUnread = {},
  notificationLevels = {},
  onSetNotificationLevel,
  onMarkChannelRead,
  guildMembers,
  onCreateCategory,
  onUpdateCategory,
  onCreateChannel,
  onUpdateChannel,
  onRoleChange,
  dmMode,
  dmFriends = [],
  dmConversations = [],
  dmPreferences = {},
  dmUnread = {},
  dmMentionCount = 0,
  dmSearchQuery = "",
  onDmSearchQueryChange,
  onOpenDmFriend,
  onOpenDmConversation,
  onUpdateDmPeerPreference
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
  activeChannelId?: string;
  labels: WorkspaceSidebarLabels;
  onSelectGuild: (guild: Guild) => void;
  onJoinVoice?: (guild: Guild) => void;
  lobbyName?: string;
  canManageGuild?: boolean;
  onRenameLobby?: (guild: Guild, name: string) => void;
  activeDmFriend?: FriendUser | null;
  onOpenDms?: () => void;
  onOpenFriends?: () => void;
  onOpenSettings?: () => void;
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
  notificationUnread?: Record<string, number>;
  notificationLevels?: Record<string, GuildNotificationLevel>;
  onSetNotificationLevel?: (channelId: string, level: GuildNotificationLevel) => void;
  onMarkChannelRead?: (channelId: string) => void;
  guildMembers?: GuildMember[];
  onCreateCategory?: (name: string) => void;
  onUpdateCategory?: (categoryId: string, updates: { name?: string; archived?: boolean }) => void;
  onCreateChannel?: (name: string, type: GuildChannelType, categoryId?: string | null) => void;
  onUpdateChannel?: (channelId: string, updates: { name?: string; archived?: boolean }) => void;
  onRoleChange?: (accountId: string, role: Exclude<GuildMember["role"], "owner">) => void;
  dmMode?: boolean;
  dmFriends?: FriendUser[];
  dmConversations?: DmConversation[];
  dmPreferences?: Record<string, DmPeerPreference>;
  dmUnread?: Record<string, number>;
  dmMentionCount?: number;
  dmSearchQuery?: string;
  onDmSearchQueryChange?: (value: string) => void;
  onOpenDmFriend?: (friend: FriendUser) => void;
  onOpenDmConversation?: (conversation: DmConversation) => void;
  onUpdateDmPeerPreference?: (
    peerId: string,
    updates: { muted?: boolean; archived?: boolean }
  ) => void;
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
          <ChannelGlyph kind="dm" />
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

      <aside className={`channels ${dmMode ? "dm-rail-mode" : ""}`}>
        {!dmMode && (
          <div className="desktop-section-title" aria-hidden="true">
            <span>◉</span>
            <b>{labels.servers || labels.appName}</b>
          </div>
        )}
        <div className={dmMode ? "hidden" : undefined}>
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
              labels.structure &&
              onCreateCategory &&
              onUpdateCategory &&
              onCreateChannel &&
              onUpdateChannel &&
              onRoleChange &&
              (activeGuild.role === "owner" || activeGuild.role === "admin") && (
                <details className="guild-structure-details">
                  <summary className="guild-manage-button">
                    ⚙︎ <span>{labels.manageChannels || labels.structure.title}</span>
                  </summary>
                  <GuildStructurePanel
                    channels={channels || []}
                    categories={categories || []}
                    members={guildMembers || []}
                    labels={labels.structure}
                    canManage
                    onClose={() => {
                      document.activeElement?.closest("details")?.removeAttribute("open");
                    }}
                    onCreateCategory={onCreateCategory}
                    onUpdateCategory={onUpdateCategory}
                    onCreateChannel={onCreateChannel}
                    onUpdateChannel={onUpdateChannel}
                    onRoleChange={onRoleChange}
                  />
                </details>
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
              <div className="channel-row" key={channel.id}>
                <button
                  className={`channel ${activeChannelId === channel.id || (!activeChannelId && index === 0) ? "active" : ""}`}
                  onClick={() => {
                    onSelectChannel?.(channel as GuildChannel);
                    onMarkChannelRead?.(channel.id);
                  }}
                >
                  <span>
                    <ChannelGlyph kind="text" />
                    <span className="sr-only"># {channel.name}</span>
                    <span className="channel-label">{channel.name}</span>
                  </span>
                  {(notificationUnread[channel.id] || 0) > 0 && (
                    <span
                      className="channel-unread-badge"
                      aria-label={`${notificationUnread[channel.id]} ${labels.unread || "unread"}`}
                    >
                      {(notificationUnread[channel.id] || 0) > 99
                        ? "99+"
                        : notificationUnread[channel.id]}
                    </span>
                  )}
                </button>
                {onSetNotificationLevel && (
                  <button
                    type="button"
                    className="channel-notification-toggle"
                    aria-label={
                      notificationLevels[channel.id] === "none"
                        ? labels.unmuteChannel || "Unmute channel notifications"
                        : labels.muteChannel || "Mute channel notifications"
                    }
                    aria-pressed={notificationLevels[channel.id] === "none"}
                    onClick={(event) => {
                      event.stopPropagation();
                      onSetNotificationLevel(
                        channel.id,
                        notificationLevels[channel.id] === "none" ? "all" : "none"
                      );
                    }}
                  >
                    <NotificationGlyph muted={notificationLevels[channel.id] === "none"} />
                  </button>
                )}
              </div>
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
                  <span>
                    <ChannelGlyph kind="voice" />
                    <span className="channel-label">{channel.name}</span>
                  </span>
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
                  <div
                    className={`voice-user-row ${speaking ? "speaking" : ""}`}
                    key={peer.socketId}
                  >
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
                          <WorkspaceGlyph
                            name={peerMuted[peer.socketId] ? "muted" : "microphone"}
                          />
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

          {onOpenSettings && (
            <button
              className="user-settings-button"
              aria-label={labels.settings || "Settings"}
              onClick={onOpenSettings}
              title={labels.settings || "Settings"}
            >
              <WorkspaceGlyph name="settings" />
            </button>
          )}

          <button aria-label={labels.microphone} onClick={onToggleMute} title={labels.microphone}>
            <WorkspaceGlyph name={muted ? "muted" : "microphone"} />
          </button>
          <button aria-label={labels.logout} onClick={onLogout} title={labels.logout}>
            <WorkspaceGlyph name="logout" />
          </button>
        </div>
      </aside>

      <MobileWorkspaceNavigation
        guilds={guilds}
        activeGuild={activeGuild}
        activeDmFriend={activeDmFriend}
        activeChannelId={activeChannelId}
        onSelectGuild={onSelectGuild}
        onJoinVoice={onJoinVoice}
        lobbyName={lobbyName}
        canManageGuild={canManageGuild}
        onRenameLobby={onRenameLobby}
        onOpenDms={onOpenDms}
        onOpenFriends={onOpenFriends}
        onOpenSettings={onOpenSettings}
        onCreateGuild={onCreateGuild}
        onJoinGuild={onJoinGuild}
        onLeaveGuild={onLeaveGuild}
        onDeleteGuild={onDeleteGuild}
        channels={channels}
        categories={categories}
        guildMembers={guildMembers}
        onCreateCategory={onCreateCategory}
        onUpdateCategory={onUpdateCategory}
        onCreateChannel={onCreateChannel}
        onUpdateChannel={onUpdateChannel}
        onRoleChange={onRoleChange}
        notificationUnread={notificationUnread}
        notificationLevels={notificationLevels}
        onSetNotificationLevel={onSetNotificationLevel}
        onMarkChannelRead={onMarkChannelRead}
        brandIconSrc={brandIconSrc}
        labels={labels}
      />
    </>
  );
}
