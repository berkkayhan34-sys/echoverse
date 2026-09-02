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

function TopbarIcon({ name }: { name: "media" | "friends" }) {
  return name === "media" ? (
    <svg
      aria-hidden="true"
      className="topbar-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="6" width="12" height="12" rx="2" />
      <path d="m15 10 6-3v10l-6-3" />
    </svg>
  ) : (
    <svg
      aria-hidden="true"
      className="topbar-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0M17 8v6M14 11h6" />
    </svg>
  );
}

function NoiseIcon() {
  return (
    <svg
      aria-hidden="true"
      className="topbar-icon noise-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 12h3M17 12h3M12 4v3M12 17v3M6.3 6.3l2.1 2.1M15.6 15.6l2.1 2.1M17.7 6.3l-2.1 2.1M8.4 15.6l-2.1 2.1" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

/** Shared server-view actions; the renderer owns every command and side effect. */
export function ServerTopbar({
  guildName,
  channelName,
  incomingRequestCount,
  status,
  labels,
  onOpenMediaSettings,
  onOpenFriends,
  onStatusChange
}: {
  guildName?: string;
  channelName?: string;
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
        <b># {channelName || labels.general}</b>
        <span>{guildName}</span>
      </div>

      <div className="top-actions">
        <button
          className="top-action-media"
          aria-label={labels.mediaSettings}
          onClick={onOpenMediaSettings}
        >
          <TopbarIcon name="media" />
          <span>{labels.mediaSettings}</span>
        </button>

        <button className="top-action-friends" aria-label={labels.friends} onClick={onOpenFriends}>
          <TopbarIcon name="friends" />
          <span>{labels.friends}</span>
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

        <div className="top-state">
          <NoiseIcon /> {labels.noiseSuppression}
        </div>
      </div>
    </header>
  );
}
