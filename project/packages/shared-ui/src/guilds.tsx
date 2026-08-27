/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import type { Guild } from "@echoverse/contracts";
import { CreateGuildDialog } from "./guild-dialog.js";
import { displayInitials } from "./text.js";

export type GuildPickerLabels = {
  title: string;
  choose: string;
  joinByCode: string;
  newGuild: string;
  joinGuild: string;
  namePlaceholder: string;
  codePlaceholder: string;
  cancel: string;
  createAction: string;
  joinAction: string;
  guildCode: (id: string) => string;
};

/**
 * Shared guild selection and create/join dialogs. The renderer owns guild
 * commands and state; this boundary owns only the browser-safe presentation.
 */
export function GuildPicker({
  guilds,
  platformLabel,
  labels,
  showCreate,
  showJoin,
  newGuildName,
  joinCode,
  error,
  onCreateOpen,
  onJoinOpen,
  onCreateClose,
  onJoinClose,
  onNewGuildNameChange,
  onJoinCodeChange,
  onCreateGuild,
  onJoinGuildByCode,
  onSelectGuild
}: {
  guilds: Guild[];
  platformLabel?: string;
  labels: GuildPickerLabels;
  showCreate: boolean;
  showJoin: boolean;
  newGuildName: string;
  joinCode: string;
  error?: string;
  onCreateOpen: () => void;
  onJoinOpen: () => void;
  onCreateClose: () => void;
  onJoinClose: () => void;
  onNewGuildNameChange: (value: string) => void;
  onJoinCodeChange: (value: string) => void;
  onCreateGuild: () => void;
  onJoinGuildByCode: () => void;
  onSelectGuild: (guild: Guild) => void;
}) {
  return (
    <div className="welcome-page">
      {platformLabel && <div className="platform-badge">{platformLabel}</div>}
      <div className="welcome-card guild-picker">
        <div className="picker-head">
          <div>
            <h1>{labels.title}</h1>
            <p>{labels.choose}</p>
          </div>

          <button className="icon-btn" aria-label={labels.createAction} onClick={onCreateOpen}>
            ＋
          </button>
        </div>

        <div className="guild-list">
          {guilds.map((guild) => (
            <button className="guild-row" key={guild.id} onClick={() => onSelectGuild(guild)}>
              <span className="guild-badge">{displayInitials(guild.name)}</span>

              <span>
                <b>{guild.name}</b>
                <small>{labels.guildCode(guild.id)}</small>
              </span>
            </button>
          ))}
        </div>

        <button className="secondary-wide" onClick={onJoinOpen}>
          {labels.joinByCode}
        </button>

        {showCreate && (
          <CreateGuildDialog
            name={newGuildName}
            labels={{
              title: labels.newGuild,
              namePlaceholder: labels.namePlaceholder,
              cancel: labels.cancel,
              create: labels.createAction
            }}
            onNameChange={onNewGuildNameChange}
            onCancel={onCreateClose}
            onCreate={onCreateGuild}
          />
        )}

        {showJoin && (
          <div className="modal-backdrop">
            <div className="modal">
              <h2>{labels.joinGuild}</h2>

              <input
                autoFocus
                placeholder={labels.codePlaceholder}
                value={joinCode}
                onChange={(event) => onJoinCodeChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") onJoinGuildByCode();
                }}
              />

              <div className="modal-actions">
                <button onClick={onJoinClose}>{labels.cancel}</button>

                <button className="primary-small" onClick={onJoinGuildByCode}>
                  {labels.joinAction}
                </button>
              </div>
            </div>
          </div>
        )}

        {error && <div className="error-box">{error}</div>}
      </div>
    </div>
  );
}
