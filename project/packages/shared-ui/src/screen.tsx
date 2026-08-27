/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import type { ScreenSource } from "@echoverse/contracts";

export type ScreenPickerLabels = {
  title: string;
  chooseSource: string;
  close: string;
  permissionOff: string;
  openSystemSettings: string;
};

/** Shared screen-source selection UI; capture and permission side effects stay in the renderer. */
export function ScreenPicker({
  sources,
  permission,
  labels,
  onClose,
  onOpenSystemSettings,
  onSelectSource
}: {
  sources: ScreenSource[];
  permission: string;
  labels: ScreenPickerLabels;
  onClose: () => void;
  onOpenSystemSettings: () => void;
  onSelectSource: (source: ScreenSource) => void;
}) {
  return (
    <div className="modal-backdrop screen-picker-backdrop">
      <div className="modal screen-picker-modal">
        <div className="screen-picker-header">
          <div>
            <h2>{labels.title}</h2>
            <p>{labels.chooseSource}</p>
          </div>
          <button aria-label={labels.close} onClick={onClose}>
            ✕
          </button>
        </div>

        {permission === "denied" && (
          <div className="screen-permission-warning">
            {labels.permissionOff}
            <button onClick={onOpenSystemSettings}>{labels.openSystemSettings}</button>
          </div>
        )}

        <div className="screen-source-grid">
          {sources.map((source) => (
            <button
              className="screen-source-card"
              key={source.id}
              onClick={() => onSelectSource(source)}
            >
              <div className="screen-source-preview">
                {source.thumbnail ? <img src={source.thumbnail} alt="" /> : <span>🖥️</span>}
              </div>
              <span>{source.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
