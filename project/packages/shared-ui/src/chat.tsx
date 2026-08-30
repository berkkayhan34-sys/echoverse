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
  pin: string;
  unpin: string;
  copyLink: string;
  pinned: string;
  searchResults: string;
  noSearchResults: string;
};

/** Renders shared guild history without owning transport state. */
export function ChannelMessageList({
  messages,
  welcomeTitle,
  channelBeginning,
  formatDate,
  labels,
  canManageMessages = false,
  onPin,
  onCopyLink
}: {
  messages: ChatMessage[];
  welcomeTitle: string;
  channelBeginning: string;
  formatDate: (value: string) => string;
  labels?: ChannelMessageLabels;
  canManageMessages?: boolean;
  onPin?: (message: ChatMessage) => void;
  onCopyLink?: (message: ChatMessage) => void;
}) {
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
            <div className="message-text">{message.text}</div>
          </div>
          {(onCopyLink || (canManageMessages && onPin)) && labels && (
            <div className="message-actions">
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

/** Renders the shared guild chat input while the renderer owns sending. */
export function ChatComposer({
  text,
  inputLabel,
  placeholder,
  emojiLabel,
  sendLabel,
  onTextChange,
  onAddEmoji,
  onSend
}: {
  text: string;
  inputLabel: string;
  placeholder: string;
  emojiLabel: string;
  sendLabel: string;
  onTextChange: (value: string) => void;
  onAddEmoji: (emoji?: string) => void;
  onSend: () => void;
}) {
  return (
    <div className="composer">
      <input
        aria-label={inputLabel}
        value={text}
        onChange={(event) => onTextChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") onSend();
        }}
        placeholder={placeholder}
      />

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
  );
}
