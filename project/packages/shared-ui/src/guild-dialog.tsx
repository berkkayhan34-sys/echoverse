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
