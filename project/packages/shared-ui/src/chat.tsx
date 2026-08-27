/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import type { ChatMessage } from "@echoverse/contracts";
import { ActionButton } from "./primitives.js";
import { displayInitials } from "./text.js";

/** Renders shared guild history without owning transport state. */
export function ChannelMessageList({
  messages,
  welcomeTitle,
  channelBeginning,
  formatDate
}: {
  messages: ChatMessage[];
  welcomeTitle: string;
  channelBeginning: string;
  formatDate: (value: string) => string;
}) {
  return (
    <section className="message-list">
      <div className="channel-intro">
        <div className="big-hash">#</div>
        <h2>{welcomeTitle}</h2>
        <p>{channelBeginning}</p>
      </div>

      {messages.map((message) => (
        <div className="message" key={message.id}>
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
            </div>
            <div className="message-text">{message.text}</div>
          </div>
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
  onAddEmoji: () => void;
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

      <ActionButton aria-label={emojiLabel} onClick={onAddEmoji}>
        😂
      </ActionButton>

      <ActionButton className="send" onClick={onSend}>
        {sendLabel}
      </ActionButton>
    </div>
  );
}
