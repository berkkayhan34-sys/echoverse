/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

export type ServerTopbarLabels = {
  general: string;
  mediaSettings: string;
  friends: string;
  status: string;
  online: string;
  idle: string;
  dnd: string;
  invisible: string;
  noiseSuppression: string;
};

export type PresenceStatus = "online" | "idle" | "dnd" | "invisible";

/** Shared server-view actions; the renderer owns every command and side effect. */
export function ServerTopbar({
  guildName,
  incomingRequestCount,
  status,
  labels,
  onOpenMediaSettings,
  onOpenFriends,
  onStatusChange
}: {
  guildName?: string;
  incomingRequestCount: number;
  status: PresenceStatus;
  labels: ServerTopbarLabels;
  onOpenMediaSettings: () => void;
  onOpenFriends: () => void;
  onStatusChange: (status: PresenceStatus) => void;
}) {
  return (
    <header className="topbar">
      <div>
        <b># {labels.general}</b>
        <span>{guildName}</span>
      </div>

      <div className="top-actions">
        <button className="top-action-media" onClick={onOpenMediaSettings}>
          ⚙ {labels.mediaSettings}
        </button>

        <button className="top-action-friends" onClick={onOpenFriends}>
          👥 {labels.friends}
          {incomingRequestCount > 0 ? ` (${incomingRequestCount})` : ""}
        </button>

        <select
          className="presence-select"
          value={status}
          onChange={(event) => onStatusChange(event.target.value as PresenceStatus)}
          title={labels.status}
        >
          <option value="online">🟢 {labels.online}</option>
          <option value="idle">🌙 {labels.idle}</option>
          <option value="dnd">⛔ {labels.dnd}</option>
          <option value="invisible">⚫ {labels.invisible}</option>
        </select>

        <div className="top-state">✨ {labels.noiseSuppression}</div>
      </div>
    </header>
  );
}
