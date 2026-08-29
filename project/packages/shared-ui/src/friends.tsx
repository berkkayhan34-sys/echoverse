/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import type { DmConversation, FriendUser } from "@echoverse/contracts";
import { displayInitials } from "./text.js";

export type FriendsModalLabels = {
  title: string;
  close: string;
  searchPlaceholder: string;
  search: string;
  searchResults: string;
  incomingRequests: string;
  outgoingRequests: string;
  myFriends: string;
  noFriends: string;
  add: string;
  pending?: string;
  friends?: string;
  cancel?: string;
  accept: string;
  decline: string;
  openDirectMessage: string;
  call: string;
  remove: string;
  groups?: string;
  createGroup?: string;
  openGroup?: string;
  promoteGroupAdmin?: string;
  removeFromGroup?: string;
  leaveGroup?: string;
};

/** Shared friends, request, and direct-message entrypoint modal. */
export function FriendsModal({
  friends,
  incomingRequests,
  outgoingRequests,
  friendSearchResults,
  conversations,
  unreadDm,
  searchQuery,
  labels,
  onClose,
  onSearchQueryChange,
  onSearch,
  onSendFriendRequest,
  onRespondFriendRequest,
  onCancelFriendRequest,
  onOpenDm,
  onCallFriend,
  onRemoveFriend,
  onOpenConversation,
  onCreateGroup,
  currentAccountId,
  onGroupPromote,
  onGroupRemove,
  onGroupLeave
}: {
  friends: FriendUser[];
  incomingRequests: FriendUser[];
  outgoingRequests: FriendUser[];
  friendSearchResults: FriendUser[];
  conversations?: DmConversation[];
  unreadDm: Record<string, number>;
  searchQuery: string;
  labels: FriendsModalLabels;
  onClose: () => void;
  onSearchQueryChange: (value: string) => void;
  onSearch: () => void;
  onSendFriendRequest: (accountId: string) => void;
  onRespondFriendRequest: (friendshipId: string, accept: boolean) => void;
  onCancelFriendRequest: (friendshipId: string) => void;
  onOpenDm: (friend: FriendUser) => void;
  onCallFriend: (friend: FriendUser) => void;
  onRemoveFriend: (accountId: string) => void;
  onOpenConversation?: (conversation: DmConversation) => void;
  onCreateGroup?: (memberIds: string[]) => void;
  currentAccountId?: string;
  onGroupPromote?: (conversationId: string, accountId: string) => void;
  onGroupRemove?: (conversationId: string, accountId: string) => void;
  onGroupLeave?: (conversationId: string) => void;
}) {
  return (
    <div className="modal-backdrop">
      <div className="modal friends-modal">
        <div className="friends-header">
          <h2>{labels.title}</h2>
          <button aria-label={labels.close} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="friend-section group-dm-section">
          <div className="section-heading-row">
            <h3>{labels.groups || labels.myFriends}</h3>
            <button
              className="secondary-small"
              onClick={() => {
                const selected = Array.from(
                  document.querySelectorAll<HTMLInputElement>(".group-member-checkbox:checked")
                ).map((input) => input.value);
                if (selected.length) onCreateGroup?.(selected);
              }}
            >
              {labels.createGroup || labels.add}
            </button>
          </div>
          {(conversations || []).map((conversation) => {
            const actor = conversation.members.find(
              (member) => member.accountId === currentAccountId
            );
            const canManage = actor && (actor.role === "owner" || actor.role === "admin");
            return (
              <div className="friend-row group-conversation-row" key={conversation.id}>
                <button
                  className="group-conversation-open"
                  onClick={() => onOpenConversation?.(conversation)}
                >
                  <b>
                    {conversation.name ||
                      conversation.members.map((member) => member.username).join(", ")}
                  </b>
                  <span>{labels.openGroup || labels.openDirectMessage}</span>
                </button>
                <div className="group-member-actions">
                  {conversation.members
                    .filter(
                      (member) => member.accountId !== currentAccountId && member.role !== "owner"
                    )
                    .map((member) => (
                      <span className="group-member-action" key={member.accountId}>
                        <small>{member.username}</small>
                        {canManage && onGroupPromote && member.role !== "admin" && (
                          <button
                            className="secondary-small"
                            onClick={() => onGroupPromote(conversation.id, member.accountId)}
                          >
                            {labels.promoteGroupAdmin || "Admin"}
                          </button>
                        )}
                        {canManage && onGroupRemove && (
                          <button
                            className="secondary-small"
                            onClick={() => onGroupRemove(conversation.id, member.accountId)}
                          >
                            {labels.removeFromGroup || labels.remove}
                          </button>
                        )}
                      </span>
                    ))}
                  {onGroupLeave && actor?.role !== "owner" && (
                    <button
                      className="secondary-small"
                      onClick={() => onGroupLeave(conversation.id)}
                    >
                      {labels.leaveGroup || labels.remove}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="friend-search-row">
          <input
            aria-label={labels.searchPlaceholder}
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onSearch();
            }}
            placeholder={labels.searchPlaceholder}
          />
          <button onClick={onSearch}>{labels.search}</button>
        </div>

        {friendSearchResults.length > 0 && (
          <div className="friend-section">
            <h3>{labels.searchResults}</h3>
            {friendSearchResults.map((friend) => (
              <div className="friend-row" key={friend.id}>
                <div className="friend-user">
                  <div className="avatar">
                    {friend.avatarData ? (
                      <img src={friend.avatarData} alt="" />
                    ) : (
                      displayInitials(friend.username)
                    )}
                  </div>
                  <b>{friend.username}</b>
                </div>
                {friend.relationship === "friends" ? (
                  <small className="friend-pending">
                    {labels.friends || labels.pending || labels.add}
                  </small>
                ) : friend.relationship === "pending_outgoing" ? (
                  <button
                    className="secondary-small"
                    disabled={!friend.friendshipId}
                    onClick={() =>
                      friend.friendshipId && onCancelFriendRequest(friend.friendshipId)
                    }
                  >
                    {labels.cancel || labels.decline}
                  </button>
                ) : friend.relationship === "pending_incoming" ? (
                  <small className="friend-pending">
                    {labels.pending || labels.outgoingRequests}
                  </small>
                ) : (
                  <button onClick={() => onSendFriendRequest(friend.id)}>＋ {labels.add}</button>
                )}
              </div>
            ))}
          </div>
        )}

        {incomingRequests.length > 0 && (
          <div className="friend-section">
            <h3>{labels.incomingRequests}</h3>
            {incomingRequests.map((friend) => (
              <div className="friend-row" key={friend.id}>
                <div className="friend-user">
                  <div className="avatar">
                    {friend.avatarData ? (
                      <img src={friend.avatarData} alt="" />
                    ) : (
                      displayInitials(friend.username)
                    )}
                  </div>
                  <b>{friend.username}</b>
                </div>
                <div className="friend-actions">
                  <button
                    aria-label={labels.accept}
                    disabled={!friend.friendshipId}
                    onClick={() => {
                      if (friend.friendshipId) onRespondFriendRequest(friend.friendshipId, true);
                    }}
                  >
                    ✓
                  </button>
                  <button
                    aria-label={labels.decline}
                    disabled={!friend.friendshipId}
                    onClick={() => {
                      if (friend.friendshipId) onRespondFriendRequest(friend.friendshipId, false);
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {outgoingRequests.length > 0 && (
          <div className="friend-section">
            <h3>{labels.outgoingRequests}</h3>
            {outgoingRequests.map((friend) => (
              <div className="friend-row" key={friend.id}>
                <div className="friend-user">
                  <div className="avatar">
                    {friend.avatarData ? (
                      <img src={friend.avatarData} alt="" />
                    ) : (
                      displayInitials(friend.username)
                    )}
                  </div>
                  <b>{friend.username}</b>
                </div>
                <div className="friend-actions">
                  <small className="friend-pending">{labels.outgoingRequests}</small>
                  {friend.friendshipId && (
                    <button
                      aria-label={labels.cancel || labels.decline}
                      onClick={() => onCancelFriendRequest(friend.friendshipId!)}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="friend-section">
          <h3>{labels.myFriends}</h3>
          {friends.length === 0 && <small>{labels.noFriends}</small>}

          {friends.map((friend) => (
            <div className="friend-row" key={friend.id}>
              <div className="friend-user">
                <div className="avatar">
                  {friend.avatarData ? (
                    <img src={friend.avatarData} alt="" />
                  ) : (
                    displayInitials(friend.username)
                  )}
                </div>
                <b>{friend.username}</b>
              </div>

              <div className="friend-actions">
                <input
                  type="checkbox"
                  className="group-member-checkbox"
                  value={friend.id}
                  aria-label={labels.createGroup || labels.add}
                />
                <button
                  className="dm-open-button"
                  aria-label={labels.openDirectMessage}
                  onClick={() => onOpenDm(friend)}
                >
                  💬
                  {(unreadDm[friend.id] || 0) > 0 && (
                    <span className="dm-unread-badge">{Math.min(unreadDm[friend.id], 99)}</span>
                  )}
                </button>
                <button aria-label={labels.call} onClick={() => onCallFriend(friend)}>
                  📞
                </button>
                <button aria-label={labels.remove} onClick={() => onRemoveFriend(friend.id)}>
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
