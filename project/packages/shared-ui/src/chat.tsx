/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import type { ChatMessage } from "@echoverse/contracts";
import { ActionButton } from "./primitives.js";
import { displayInitials } from "./text.js";

const EMOJI_CATALOG = [
  "😀",
  "😃",
  "😄",
  "😁",
  "😆",
  "😅",
  "😂",
  "🤣",
  "😊",
  "🙂",
  "🙃",
  "😉",
  "😌",
  "😍",
  "🥰",
  "😘",
  "😗",
  "😙",
  "😚",
  "😋",
  "😛",
  "😝",
  "😜",
  "🤪",
  "🤨",
  "🧐",
  "🤓",
  "😎",
  "🤩",
  "🥳",
  "😏",
  "😒",
  "😞",
  "😔",
  "😟",
  "😕",
  "🙁",
  "☹️",
  "😣",
  "😖",
  "😫",
  "😩",
  "🥺",
  "😢",
  "😭",
  "😤",
  "😠",
  "😡",
  "🤬",
  "🤯",
  "😳",
  "🥵",
  "🥶",
  "😱",
  "😨",
  "😰",
  "😥",
  "😓",
  "🤗",
  "🤔",
  "🫡",
  "🤭",
  "🤫",
  "🤥",
  "😶",
  "😐",
  "😑",
  "😬",
  "🙄",
  "😯",
  "😦",
  "😧",
  "😮",
  "😲",
  "🥱",
  "😴",
  "🤤",
  "😪",
  "😵",
  "🤐",
  "🥴",
  "🤢",
  "🤮",
  "🤧",
  "😷",
  "🤠",
  "👋",
  "🤚",
  "🖐️",
  "✋",
  "👌",
  "🤌",
  "🤏",
  "✌️",
  "🤞",
  "🤟",
  "🤘",
  "🤙",
  "👍",
  "👎",
  "👏",
  "🙌",
  "👐",
  "🤝",
  "🙏",
  "💪",
  "❤️",
  "🧡",
  "💛",
  "💚",
  "💙",
  "💜",
  "🖤",
  "🤍",
  "🤎",
  "💔",
  "💕",
  "💯",
  "✨",
  "🔥",
  "🎉",
  "🎊",
  "✅",
  "❌",
  "⚠️",
  "💡",
  "🎵",
  "🚀",
  "⭐",
  "🌟",
  "☀️",
  "🌈",
  "🍕",
  "🍔",
  "🍟",
  "🌮",
  "🍎",
  "🍺",
  "☕",
  "🎂",
  "⚽",
  "🎮",
  "🎧",
  "🐶",
  "🐱",
  "🦊",
  "🐻",
  "🐼",
  "🐸",
  "🐵",
  "🦄",
  "🐝",
  "🌸",
  "🌹",
  "🌻",
  "🌙",
  "🌍"
] as const;

const COMMON_EMOJI = [
  "😀",
  "😂",
  "😍",
  "😎",
  "😭",
  "😡",
  "👍",
  "👎",
  "👏",
  "🙏",
  "🔥",
  "✨",
  "🎉",
  "✅",
  "❌",
  "❤️"
] as const;

export type ChannelMessageLabels = {
  reply?: string;
  clearReply?: string;
  thread?: string;
  pin: string;
  unpin: string;
  copyLink: string;
  pinned: string;
  searchResults: string;
  noSearchResults: string;
};

export type ChatMentionCandidate = {
  accountId: string;
  username: string;
  avatarData?: string | null;
};

/** Renders shared guild history without owning transport state. */
export function ChannelMessageList({
  messages,
  welcomeTitle,
  channelBeginning,
  formatDate,
  labels,
  canManageMessages = false,
  onReply,
  onOpenThread,
  onPin,
  onCopyLink
}: {
  messages: ChatMessage[];
  welcomeTitle: string;
  channelBeginning: string;
  formatDate: (value: string) => string;
  labels?: ChannelMessageLabels;
  canManageMessages?: boolean;
  onReply?: (message: ChatMessage) => void;
  onOpenThread?: (message: ChatMessage) => void;
  onPin?: (message: ChatMessage) => void;
  onCopyLink?: (message: ChatMessage) => void;
}) {
  const messagesById = new Map(messages.map((message) => [message.id, message]));

  return (
    <section className="message-list">
      <div className="channel-intro">
        <div className="big-hash">#</div>
        <h2>{welcomeTitle}</h2>
        <p>{channelBeginning}</p>
      </div>

      {messages.map((message) => (
        <div
          className={`message ${message.pinned ? "pinned" : ""}`}
          key={message.id}
          id={`message-${message.id}`}
        >
          <div className={`avatar ${message.bot ? "bot" : ""}`}>
            {!message.bot && message.avatarData ? (
              <img src={message.avatarData} alt="" />
            ) : message.bot ? (
              "EB"
            ) : (
              displayInitials(message.username)
            )}
          </div>

          <div className="message-body">
            <div className="message-meta">
              <b>{message.username}</b>
              <small>{formatDate(message.createdAt)}</small>
              {message.pinned && labels?.pinned && (
                <span className="message-pinned-badge">📌 {labels.pinned}</span>
              )}
            </div>
            {message.replyToId && (
              <div className="message-reply-preview">
                ↩ {messagesById.get(message.replyToId)?.username || labels?.reply}
                {messagesById.get(message.replyToId)?.text
                  ? `: ${messagesById.get(message.replyToId)?.text}`
                  : ""}
              </div>
            )}
            <div className="message-text">{message.text}</div>
          </div>
          {(onReply || onOpenThread || onCopyLink || (canManageMessages && onPin)) && labels && (
            <div className="message-actions">
              {onReply && (
                <button
                  type="button"
                  className="message-action"
                  aria-label={labels.reply || "Reply"}
                  title={labels.reply || "Reply"}
                  onClick={() => onReply(message)}
                >
                  ↩
                </button>
              )}
              {onOpenThread && (
                <button
                  type="button"
                  className="message-action"
                  aria-label={labels.thread || "Open thread"}
                  title={labels.thread || "Open thread"}
                  onClick={() => onOpenThread(message)}
                >
                  ▤
                </button>
              )}
              {onCopyLink && (
                <button
                  type="button"
                  className="message-action"
                  aria-label={labels.copyLink}
                  title={labels.copyLink}
                  onClick={() => onCopyLink(message)}
                >
                  🔗
                </button>
              )}
              {canManageMessages && onPin && (
                <button
                  type="button"
                  className="message-action"
                  aria-label={message.pinned ? labels.unpin : labels.pin}
                  title={message.pinned ? labels.unpin : labels.pin}
                  onClick={() => onPin(message)}
                >
                  {message.pinned ? "📌" : "📍"}
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

function threadReplies(rootId: string, messages: ChatMessage[]) {
  const repliesByParent = new Map<string, ChatMessage[]>();
  for (const message of messages) {
    if (!message.replyToId) continue;
    const replies = repliesByParent.get(message.replyToId) || [];
    replies.push(message);
    repliesByParent.set(message.replyToId, replies);
  }
  const replies: ChatMessage[] = [];
  const pending = [...(repliesByParent.get(rootId) || [])];
  while (pending.length > 0) {
    const next = pending.shift();
    if (!next) continue;
    replies.push(next);
    pending.push(...(repliesByParent.get(next.id) || []));
  }
  return replies;
}

/** Renders a focused thread view from the channel's persisted reply links. */
export function ChannelThreadPanel({
  root,
  messages,
  labels,
  formatDate,
  onReply,
  onClose
}: {
  root: ChatMessage;
  messages: ChatMessage[];
  labels: {
    title: string;
    close: string;
    reply: string;
    noReplies: string;
  };
  formatDate: (value: string) => string;
  onReply: (message: ChatMessage) => void;
  onClose: () => void;
}) {
  const replies = threadReplies(root.id, messages);
  return (
    <aside className="thread-panel" aria-label={labels.title}>
      <div className="thread-panel-header">
        <div>
          <strong>{labels.title}</strong>
          <span>{root.username}</span>
        </div>
        <button type="button" className="thread-close" aria-label={labels.close} onClick={onClose}>
          ✕
        </button>
      </div>
      <article className="thread-root">
        <div className="message-meta">
          <b>{root.username}</b>
          <small>{formatDate(root.createdAt)}</small>
        </div>
        <div className="message-text">{root.text}</div>
        <button type="button" className="thread-reply-button" onClick={() => onReply(root)}>
          ↩ {labels.reply}
        </button>
      </article>
      <div className="thread-replies" aria-live="polite">
        {replies.length === 0 ? (
          <p className="thread-empty">{labels.noReplies}</p>
        ) : (
          replies.map((message) => (
            <article className="thread-message" key={message.id}>
              <div className="message-meta">
                <b>{message.username}</b>
                <small>{formatDate(message.createdAt)}</small>
              </div>
              <div className="message-text">{message.text}</div>
              <button
                type="button"
                className="thread-reply-button"
                onClick={() => onReply(message)}
              >
                ↩ {labels.reply}
              </button>
            </article>
          ))
        )}
      </div>
    </aside>
  );
}

/** Renders the shared guild chat input while the renderer owns sending. */
export function ChatComposer({
  text,
  inputLabel,
  placeholder,
  emojiLabel,
  sendLabel,
  replyingTo,
  clearReplyLabel,
  onClearReply,
  onTextChange,
  onAddEmoji,
  mentionCandidates = [],
  mentionLabel = "Mention a member",
  onSend
}: {
  text: string;
  inputLabel: string;
  placeholder: string;
  emojiLabel: string;
  sendLabel: string;
  replyingTo?: { username: string; text: string } | null;
  clearReplyLabel?: string;
  onClearReply?: () => void;
  onTextChange: (value: string) => void;
  onAddEmoji: (emoji?: string) => void;
  mentionCandidates?: ChatMentionCandidate[];
  mentionLabel?: string;
  onSend: () => void;
}) {
  const mentionMatch = text.match(/(?:^|\s)@([^\s@]*)$/u);
  const mentionQuery = mentionMatch?.[1]?.toLocaleLowerCase() || "";
  const mentionStart = mentionMatch ? text.lastIndexOf("@") : -1;
  const suggestions =
    mentionStart >= 0
      ? mentionCandidates
          .filter((candidate) => candidate.username.toLocaleLowerCase().includes(mentionQuery))
          .slice(0, 8)
      : [];

  return (
    <div className={`composer${replyingTo ? " has-context" : ""}`}>
      {replyingTo && (
        <div className="composer-context" role="status">
          <span>
            ↩ {replyingTo.username}: {replyingTo.text}
          </span>
          {onClearReply && (
            <button
              type="button"
              aria-label={clearReplyLabel || "Clear reply"}
              onClick={onClearReply}
            >
              ✕
            </button>
          )}
        </div>
      )}
      <div className="composer-controls">
        <input
          aria-label={inputLabel}
          value={text}
          onChange={(event) => onTextChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onSend();
          }}
          placeholder={placeholder}
        />
        {suggestions.length > 0 && (
          <div className="mention-suggestions" role="listbox" aria-label={mentionLabel}>
            {suggestions.map((candidate) => (
              <button
                key={candidate.accountId}
                type="button"
                role="option"
                className="mention-suggestion"
                onClick={() => {
                  const nextText = `${text.slice(0, mentionStart)}@${candidate.username} `;
                  onTextChange(nextText);
                }}
              >
                <span className="avatar avatar-small">
                  {candidate.avatarData ? (
                    <img src={candidate.avatarData} alt="" />
                  ) : (
                    displayInitials(candidate.username)
                  )}
                </span>
                <span>@{candidate.username}</span>
              </button>
            ))}
          </div>
        )}

        <details className="emoji-picker-wrap" aria-label={emojiLabel}>
          <summary className="emoji-trigger" aria-label={emojiLabel} title={emojiLabel}>
            😊
          </summary>
          <div className="emoji-picker" role="dialog" aria-label={emojiLabel}>
            <input
              className="emoji-search"
              onChange={(event) => {
                const query = event.target.value.trim();
                const buttons =
                  event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                    ".emoji-grid button"
                  );
                buttons?.forEach((button) => {
                  button.hidden = Boolean(query) && !button.dataset.emoji?.includes(query);
                });
              }}
              placeholder={emojiLabel}
              aria-label={emojiLabel}
            />
            <div className="emoji-grid">
              {[...new Set([...COMMON_EMOJI, ...EMOJI_CATALOG])].map((emoji) => (
                <button
                  key={emoji}
                  data-emoji={emoji}
                  type="button"
                  aria-label={emoji}
                  onClick={() => {
                    let recent: unknown[] = [];
                    try {
                      const stored = JSON.parse(
                        localStorage.getItem("echoverse_recent_emoji") || "[]"
                      );
                      if (Array.isArray(stored)) recent = stored;
                    } catch {}
                    const next = [
                      emoji,
                      ...recent.filter(
                        (item): item is string => typeof item === "string" && item !== emoji
                      )
                    ].slice(0, 24);
                    try {
                      localStorage.setItem("echoverse_recent_emoji", JSON.stringify(next));
                    } catch {}
                    onAddEmoji(emoji);
                    (document.activeElement as HTMLElement | null)?.blur();
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </details>

        <ActionButton className="send composer-send" onClick={onSend}>
          {sendLabel}
        </ActionButton>
      </div>
    </div>
  );
}
