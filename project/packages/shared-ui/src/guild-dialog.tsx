/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

export type CreateGuildDialogLabels = {
  title: string;
  namePlaceholder: string;
  cancel: string;
  create: string;
};

export type JoinGuildDialogLabels = {
  title: string;
  codePlaceholder: string;
  cancel: string;
  join: string;
};

/** Shared create-guild form; validation and persistence remain renderer-owned. */
export function CreateGuildDialog({
  name,
  labels,
  onNameChange,
  onCancel,
  onCreate
}: {
  name: string;
  labels: CreateGuildDialogLabels;
  onNameChange: (name: string) => void;
  onCancel: () => void;
  onCreate: () => void;
}) {
  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-modal="true" aria-label={labels.title}>
        <h2>{labels.title}</h2>

        <input
          autoFocus
          aria-label={labels.namePlaceholder}
          placeholder={labels.namePlaceholder}
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onCreate();
          }}
        />

        <div className="modal-actions">
          <button onClick={onCancel}>{labels.cancel}</button>
          <button className="primary-small" onClick={onCreate}>
            {labels.create}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Shared invite-code form; the renderer owns the join command and error state. */
export function JoinGuildDialog({
  code,
  labels,
  onCodeChange,
  onCancel,
  onJoin
}: {
  code: string;
  labels: JoinGuildDialogLabels;
  onCodeChange: (code: string) => void;
  onCancel: () => void;
  onJoin: () => void;
}) {
  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-modal="true" aria-label={labels.title}>
        <h2>{labels.title}</h2>

        <input
          autoFocus
          aria-label={labels.codePlaceholder}
          placeholder={labels.codePlaceholder}
          value={code}
          onChange={(event) => onCodeChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onJoin();
          }}
        />

        <div className="modal-actions">
          <button onClick={onCancel}>{labels.cancel}</button>
          <button className="primary-small" onClick={onJoin}>
            {labels.join}
          </button>
        </div>
      </div>
    </div>
  );
}
