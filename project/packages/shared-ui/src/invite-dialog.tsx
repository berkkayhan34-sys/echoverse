/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

export type InviteDialogLabels = {
  title: string;
  description: string;
  copy: string;
  copied: string;
  close: string;
};

/** Displays a newly-created invite without exposing it through a browser alert. */
export function InviteDialog({
  guildName,
  token,
  copied,
  labels,
  onCopy,
  onClose
}: {
  guildName: string;
  token: string;
  copied: boolean;
  labels: InviteDialogLabels;
  onCopy: () => void;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop">
      <div
        className="modal invite-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={labels.title}
      >
        <div className="invite-dialog-heading">
          <div>
            <h2>{labels.title.replace("{{guild}}", guildName)}</h2>
            <p>{guildName}</p>
          </div>
          <button className="icon-btn" aria-label={labels.close} onClick={onClose}>
            ✕
          </button>
        </div>
        <p className="invite-dialog-description">{labels.description}</p>
        <code className="invite-code" aria-label={labels.description}>
          {token}
        </code>
        <div className="modal-actions">
          <button onClick={onClose}>{labels.close}</button>
          <button className="primary-small" onClick={onCopy}>
            {copied ? labels.copied : labels.copy}
          </button>
        </div>
      </div>
    </div>
  );
}
