/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { Fragment } from "react";
import type { DmMessage } from "@echoverse/contracts";
import { ActionButton } from "./primitives.js";
import { displayInitials } from "./text.js";

/** Renders direct-message history while the renderer owns its commands. */
export function DirectMessageThread({
  messages,
  query,
  currentAccountId,
  currentUsername,
  currentAvatarData,
  peer,
  threadRef,
  labels,
  formatDate,
  formatTime,
  onReply,
  onReact,
  onEdit,
  onDelete,
  onDownloadAttachment,
  onOpenAttachment
}: {
  messages: DmMessage[];
  query: string;
  currentAccountId: string;
  currentUsername: string;
  currentAvatarData?: string | null;
  peer: { username: string; avatarData?: string | null };
  threadRef?: { current: HTMLDivElement | null };
  labels: {
    today: string;
    emptyConversation: string;
    deletedReply: string;
    deletedMessage: string;
    message: string;
    edited: string;
    download: string;
    reply: string;
    edit: string;
    delete: string;
  };
  formatDate: (value: string) => string;
  formatTime: (value: string) => string;
  onReply: (message: DmMessage) => void;
  onReact: (messageId: string, emoji: string) => void;
  onEdit: (message: DmMessage) => void;
  onDelete: (message: DmMessage) => void;
  onDownloadAttachment: (message: DmMessage) => void;
  onOpenAttachment: (data: string) => void;
}) {
  const normalizedQuery = query.trim().toLowerCase();
  const filteredMessages = messages.filter((message) => {
    if (!normalizedQuery) return true;
    return (
      message.body?.toLowerCase().includes(normalizedQuery) ||
      message.attachmentName?.toLowerCase().includes(normalizedQuery)
    );
  });

  return (
    <div
      className="dm-thread"
      ref={(element) => {
        if (threadRef) threadRef.current = element;
      }}
    >
      {messages.length === 0 && (
        <div className="dm-empty">
          <div className="avatar large">
            {peer.avatarData ? (
              <img src={peer.avatarData} alt="" />
            ) : (
              displayInitials(peer.username)
            )}
          </div>
          <h2>{peer.username}</h2>
          <p>{labels.emptyConversation}</p>
        </div>
      )}

      {filteredMessages.map((message, index) => {
        const mine = message.senderId === currentAccountId;
        const previous = index > 0 ? filteredMessages[index - 1] : null;
        const currentDate = new Date(message.createdAt);
        const previousDate = previous ? new Date(previous.createdAt) : null;
        const showDate =
          !previousDate || previousDate.toDateString() !== currentDate.toDateString();
        const replied = message.replyToId
          ? messages.find((candidate) => candidate.id === message.replyToId)
          : null;
        const senderName = mine ? currentUsername : peer.username;
        const senderAvatarData = mine ? currentAvatarData : peer.avatarData;

        return (
          <Fragment key={message.id}>
            {showDate && (
              <div className="dm-date-divider">
                <span>
                  {currentDate.toDateString() === new Date().toDateString()
                    ? labels.today
                    : formatDate(message.createdAt)}
                </span>
              </div>
            )}

            <div
              className={`dm-discord-message ${mine ? "mine" : ""} ${message.deletedAt ? "deleted" : ""}`}
            >
              <div className="avatar">
                {senderAvatarData ? (
                  <img src={senderAvatarData} alt="" />
                ) : (
                  displayInitials(senderName)
                )}
              </div>

              <div className="dm-discord-body">
                <div className="dm-discord-meta">
                  <b>{senderName}</b>
                  <small>{formatTime(message.createdAt)}</small>
                  {message.editedAt && !message.deletedAt && <small>{labels.edited}</small>}
                </div>

                {replied && (
                  <div className="dm-reply-preview">
                    ↪{" "}
                    {replied.deletedAt
                      ? labels.deletedReply
                      : replied.body || replied.attachmentName || labels.message}
                  </div>
                )}

                {message.deletedAt ? (
                  <div className="dm-deleted-text">{labels.deletedMessage}</div>
                ) : (
                  <>
                    {message.body && <div className="dm-discord-text">{message.body}</div>}

                    {message.attachmentData && message.attachmentName && (
                      <div className="dm-attachment">
                        {message.attachmentMime?.startsWith("image/") ? (
                          <img
                            src={message.attachmentData}
                            alt={message.attachmentName}
                            onClick={() => onOpenAttachment(message.attachmentData || "")}
                          />
                        ) : (
                          <div className="dm-file-icon">📎</div>
                        )}
                        <div>
                          <b>{message.attachmentName}</b>
                          <button onClick={() => onDownloadAttachment(message)}>
                            {labels.download}
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="dm-reactions">
                      {Object.entries(message.reactions || {}).map(([emoji, ids]) => (
                        <button
                          key={emoji}
                          className={ids.includes(currentAccountId) ? "mine" : ""}
                          onClick={() => onReact(message.id, emoji)}
                        >
                          {emoji} {ids.length}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {!message.deletedAt && (
                  <div className="dm-message-actions">
                    <button onClick={() => onReply(message)}>↩ {labels.reply}</button>
                    {["👍", "❤️", "😂", "🔥"].map((emoji) => (
                      <button key={emoji} onClick={() => onReact(message.id, emoji)}>
                        {emoji}
                      </button>
                    ))}
                    {mine && <button onClick={() => onEdit(message)}>✏ {labels.edit}</button>}
                    {mine && (
                      <button
                        className="danger"
                        aria-label={labels.delete}
                        onClick={() => onDelete(message)}
                      >
                        🗑 {labels.delete}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}

/** Renders the direct-message composer while the renderer owns file handling. */
export function DirectMessageComposer({
  text,
  inputLabel,
  placeholder,
  fileLabel,
  clearLabel,
  dragHint,
  sendLabel,
  editingLabel,
  replyingLabel,
  attachmentReadyLabel,
  dragActive,
  fileInputRef,
  onFileSelected,
  onDropFile,
  onDragActiveChange,
  onTextChange,
  onTypingChange,
  onSend,
  onClearContext
}: {
  text: string;
  inputLabel: string;
  placeholder: string;
  fileLabel: string;
  clearLabel: string;
  dragHint: string;
  sendLabel: string;
  editingLabel?: string;
  replyingLabel?: string;
  attachmentReadyLabel?: string;
  dragActive: boolean;
  fileInputRef?: { current: HTMLInputElement | null };
  onFileSelected: (file: File | null) => void;
  onDropFile: (file: File | null) => void;
  onDragActiveChange: (active: boolean) => void;
  onTextChange: (value: string) => void;
  onTypingChange: (typing: boolean) => void;
  onSend: () => void;
  onClearContext: () => void;
}) {
  const hasContext = Boolean(editingLabel || replyingLabel || attachmentReadyLabel);

  return (
    <div className="dm-composer-zone">
      {hasContext && (
        <div className="dm-compose-context">
          {editingLabel && <span>{editingLabel}</span>}
          {replyingLabel && !editingLabel && <span>{replyingLabel}</span>}
          {attachmentReadyLabel && <span>{attachmentReadyLabel}</span>}
          <ActionButton aria-label={clearLabel} onClick={onClearContext}>
            ✕
          </ActionButton>
        </div>
      )}

      <div
        className={`dm-page-composer ${dragActive ? "drag-active" : ""}`}
        onDragEnter={(event) => {
          event.preventDefault();
          onDragActiveChange(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          onDragActiveChange(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          onDragActiveChange(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          onDragActiveChange(false);
          onDropFile(event.dataTransfer.files?.[0] || null);
        }}
      >
        {dragActive && <div className="dm-drop-hint">{dragHint}</div>}
        <input
          ref={(element) => {
            if (fileInputRef) fileInputRef.current = element;
          }}
          type="file"
          className="hidden-file-input"
          onChange={(event) => {
            onFileSelected(event.target.files?.[0] || null);
            event.currentTarget.value = "";
          }}
        />

        <ActionButton
          className="dm-attach-button"
          aria-label={fileLabel}
          title={fileLabel}
          onClick={() => fileInputRef?.current?.click()}
        >
          ＋
        </ActionButton>

        <input
          aria-label={inputLabel}
          value={text}
          onFocus={() => onTypingChange(true)}
          onBlur={() => onTypingChange(false)}
          onChange={(event) => {
            onTextChange(event.target.value);
            onTypingChange(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSend();
            }
          }}
          placeholder={placeholder}
        />
        <ActionButton onClick={onSend}>{sendLabel}</ActionButton>
      </div>
    </div>
  );
}
