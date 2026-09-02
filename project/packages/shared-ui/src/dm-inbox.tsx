/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import type { DmConversation, DmPeerPreference, FriendUser } from "@echoverse/contracts";
import { displayInitials } from "./text.js";

export type DirectMessageInboxLabels = {
  title: string;
  searchPlaceholder: string;
  friends: string;
  groups: string;
  messageRequests: string;
  openFriends: string;
  noFriends: string;
  noConversations: string;
  memberCount: (count: number) => string;
  mentions: string;
  mute?: string;
  unmute?: string;
  archive?: string;
  unarchive?: string;
};

function conversationTitle(conversation: DmConversation, accountId?: string) {
  return (
    conversation.name ||
    conversation.members
      .filter((member) => member.accountId !== accountId)
      .map((member) => member.username)
      .join(", ")
  );
}

type InboxIconName = "add" | "search" | "group" | "request" | "mute" | "archive";

function InboxIcon({ name }: { name: InboxIconName }) {
  const path = {
    add: (
      <>
        <path d="M12 5v14M5 12h14" />
      </>
    ),
    search: <path d="m20 20-4.2-4.2M10.8 17a6.2 6.2 0 1 1 0-12.4 6.2 6.2 0 0 1 0 12.4Z" />,
    group: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 6.5a2.5 2.5 0 0 1 0 5M16 14a4 4 0 0 1 4 4" />
      </>
    ),
    request: (
      <>
        <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 3v-3.06A2.5 2.5 0 0 1 4 13.5v-7Z" />
        <path d="M8 8.5h8M8 12h5" />
      </>
    ),
    mute: <path d="M5 5l14 14M9.5 5.8A5 5 0 0 1 17 10v3l2 2H8M6 15h12M10 19h4" />,
    archive: (
      <>
        <path d="M4 7h16M5.5 7v11.5h13V7M8 4h8l1.5 3h-11L8 4Z" />
        <path d="M9 11h6" />
      </>
    )
  }[name];

  return (
    <svg
      className={`dm-inbox-icon dm-inbox-icon-${name}`}
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
    >
      {path}
    </svg>
  );
}

/** Persistent, shared DM navigation used by the web and desktop renderers. */
export function DirectMessageInbox({
  friends,
  conversations,
  unread,
  searchQuery,
  currentAccountId,
  mentionCount = 0,
  preferences = {},
  labels,
  compact = false,
  onSearchQueryChange,
  onOpenFriends,
  onOpenDm,
  onOpenConversation,
  onUpdatePeerPreference
}: {
  friends: FriendUser[];
  conversations: DmConversation[];
  unread: Record<string, number>;
  searchQuery: string;
  currentAccountId?: string;
  mentionCount?: number;
  preferences?: Record<string, DmPeerPreference>;
  labels: DirectMessageInboxLabels;
  compact?: boolean;
  onSearchQueryChange: (value: string) => void;
  onOpenFriends: () => void;
  onOpenDm: (friend: FriendUser) => void;
  onOpenConversation: (conversation: DmConversation) => void;
  onUpdatePeerPreference?: (
    peerId: string,
    updates: { muted?: boolean; archived?: boolean }
  ) => void;
}) {
  const query = searchQuery.trim().toLocaleLowerCase();
  const visibleFriends = friends.filter((friend) =>
    !query ? true : friend.username.toLocaleLowerCase().includes(query)
  );
  const visibleConversations = conversations.filter((conversation) =>
    !query
      ? true
      : conversationTitle(conversation, currentAccountId).toLocaleLowerCase().includes(query)
  );

  return (
    <section className={`dm-inbox ${compact ? "dm-inbox-compact" : ""}`} aria-label={labels.title}>
      <header className="dm-inbox-header">
        <div>
          <h2>{labels.title}</h2>
          {!compact && <p>{labels.friends}</p>}
        </div>
        <button className="dm-inbox-friends-button" type="button" onClick={onOpenFriends}>
          <InboxIcon name="add" />
          <span>{labels.openFriends}</span>
        </button>
      </header>

      <label className="dm-inbox-search">
        <InboxIcon name="search" />
        <input
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder={labels.searchPlaceholder}
          aria-label={labels.searchPlaceholder}
        />
      </label>

      {visibleFriends.length === 0 && visibleConversations.length === 0 ? (
        <div className="dm-inbox-empty-state">
          <span className="dm-inbox-empty-icon">
            <InboxIcon name="group" />
          </span>
          <strong>{labels.noFriends}</strong>
          <p>{labels.noConversations}</p>
          <button type="button" onClick={onOpenFriends}>
            <InboxIcon name="add" />
            <span>{labels.openFriends}</span>
          </button>
        </div>
      ) : (
        <>
          <div className="dm-inbox-section">
            <h3>{labels.friends}</h3>
            {visibleFriends.length === 0 && <p className="dm-inbox-empty">{labels.noFriends}</p>}
            {visibleFriends.map((friend) => {
              const count = unread[friend.id] || 0;
              const preference = preferences[friend.id] || {
                peerId: friend.id,
                muted: false,
                archived: false
              };
              const visibleUnread = preference.muted ? 0 : count;
              return (
                <div className="dm-inbox-row-wrap" key={friend.id}>
                  <button className="dm-inbox-row" type="button" onClick={() => onOpenDm(friend)}>
                    <span className="avatar">
                      {friend.avatarData ? (
                        <img src={friend.avatarData} alt="" />
                      ) : (
                        displayInitials(friend.username)
                      )}
                    </span>
                    <span className="dm-inbox-row-copy">
                      <b>{friend.username}</b>
                      <small className={friend.status === "online" ? "is-online" : undefined}>
                        <span className="dm-presence-dot" aria-hidden="true" />
                      </small>
                    </span>
                    {preference.muted && (
                      <span className="dm-inbox-state" title={labels.mute || "Muted"}>
                        <InboxIcon name="mute" />
                      </span>
                    )}
                    {preference.archived && (
                      <span className="dm-inbox-state" title={labels.archive || "Archived"}>
                        <InboxIcon name="archive" />
                      </span>
                    )}
                    {visibleUnread > 0 && (
                      <span className="dm-inbox-unread">
                        {visibleUnread > 99 ? "99+" : visibleUnread}
                      </span>
                    )}
                  </button>
                  {onUpdatePeerPreference && (
                    <div className="dm-inbox-row-actions">
                      <button
                        type="button"
                        className="dm-inbox-row-action"
                        aria-label={
                          preference.muted
                            ? labels.unmute || "Unmute notifications"
                            : labels.mute || "Mute notifications"
                        }
                        title={
                          preference.muted
                            ? labels.unmute || "Unmute notifications"
                            : labels.mute || "Mute notifications"
                        }
                        onClick={() =>
                          onUpdatePeerPreference(friend.id, { muted: !preference.muted })
                        }
                      >
                        <InboxIcon name="mute" />
                      </button>
                      <button
                        type="button"
                        className="dm-inbox-row-action"
                        aria-label={
                          preference.archived
                            ? labels.unarchive || "Unarchive conversation"
                            : labels.archive || "Archive conversation"
                        }
                        title={
                          preference.archived
                            ? labels.unarchive || "Unarchive conversation"
                            : labels.archive || "Archive conversation"
                        }
                        onClick={() =>
                          onUpdatePeerPreference(friend.id, { archived: !preference.archived })
                        }
                      >
                        <InboxIcon name="archive" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="dm-inbox-section">
            <h3>{labels.groups}</h3>
            {visibleConversations.length === 0 && (
              <p className="dm-inbox-empty">{labels.noConversations}</p>
            )}
            {visibleConversations.map((conversation) => {
              const count = unread[conversation.id] || 0;
              return (
                <button
                  className="dm-inbox-row"
                  type="button"
                  key={conversation.id}
                  onClick={() => onOpenConversation(conversation)}
                >
                  <span className="avatar dm-group-avatar">
                    <InboxIcon name="group" />
                  </span>
                  <span className="dm-inbox-row-copy">
                    <b>{conversationTitle(conversation, currentAccountId) || labels.groups}</b>
                    <small>{labels.memberCount(conversation.members.length)}</small>
                  </span>
                  {count > 0 && (
                    <span className="dm-inbox-unread">{count > 99 ? "99+" : count}</span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      <button className="dm-inbox-requests" type="button" onClick={onOpenFriends}>
        <InboxIcon name="request" />
        <span>{labels.messageRequests}</span>
      </button>
      {mentionCount > 0 && (
        <div className="dm-inbox-mentions" role="status">
          <span className="dm-mention-mark" aria-hidden="true">
            @
          </span>
          <span>{labels.mentions}</span>
          <b>{mentionCount > 99 ? "99+" : mentionCount}</b>
        </div>
      )}
    </section>
  );
}
