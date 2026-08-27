/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

export type MediaSettingsLabels = {
  title: string;
  description: string;
  microphoneInput: string;
  speakerOutput: string;
  speakerFallback: (id: string) => string;
  systemDefault: string;
  videoSection: string;
  cameraInput: string;
  microphoneFallback: (id: string) => string;
  cameraFallback: (id: string) => string;
  screenQualityLabel: string;
  quality: (quality: number) => string;
  fps: string;
  shareProfile: (quality: string, fps: number) => string;
  changeNotice: string;
  lobbySounds: string;
  lobbySoundsDescription: string;
  effectVolume: (volume: number) => string;
  close: string;
};

/** Shared device and media-preference controls; persistence stays in the renderer. */
export function MediaSettingsModal({
  audioInputs,
  audioOutputs,
  videoInputs,
  selectedInput,
  selectedOutput,
  selectedCamera,
  screenQuality,
  screenFps,
  lobbySoundsEnabled,
  effectVolume,
  labels,
  onInputChange,
  onOutputChange,
  onCameraChange,
  onScreenQualityChange,
  onScreenFpsChange,
  onLobbySoundsChange,
  onEffectVolumeChange,
  onClose
}: {
  audioInputs: MediaDeviceInfo[];
  audioOutputs: MediaDeviceInfo[];
  videoInputs: MediaDeviceInfo[];
  selectedInput: string;
  selectedOutput: string;
  selectedCamera: string;
  screenQuality: "720" | "1080";
  screenFps: 30 | 60;
  lobbySoundsEnabled: boolean;
  effectVolume: number;
  labels: MediaSettingsLabels;
  onInputChange: (deviceId: string) => void | Promise<void>;
  onOutputChange: (deviceId: string) => void | Promise<void>;
  onCameraChange: (deviceId: string) => void | Promise<void>;
  onScreenQualityChange: (quality: "720" | "1080") => void;
  onScreenFpsChange: (fps: 30 | 60) => void;
  onLobbySoundsChange: (enabled: boolean) => void;
  onEffectVolumeChange: (volume: number) => void;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop">
      <div className="modal audio-settings-modal">
        <h2>{labels.title}</h2>
        <p className="settings-subtitle">{labels.description}</p>

        <label>{labels.microphoneInput}</label>
        <select value={selectedInput} onChange={(event) => onInputChange(event.target.value)}>
          <option value="">{labels.systemDefault}</option>
          {audioInputs.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || labels.microphoneFallback(device.deviceId.slice(0, 6))}
            </option>
          ))}
        </select>

        <label>{labels.speakerOutput}</label>
        <select value={selectedOutput} onChange={(event) => onOutputChange(event.target.value)}>
          <option value="">{labels.systemDefault}</option>
          {audioOutputs.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || labels.speakerFallback(device.deviceId.slice(0, 6))}
            </option>
          ))}
        </select>

        <div className="settings-divider">{labels.videoSection}</div>

        <label>{labels.cameraInput}</label>
        <select value={selectedCamera} onChange={(event) => onCameraChange(event.target.value)}>
          <option value="">{labels.systemDefault}</option>
          {videoInputs.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || labels.cameraFallback(device.deviceId.slice(0, 6))}
            </option>
          ))}
        </select>

        <div className="video-quality-grid">
          <div>
            <label>{labels.screenQualityLabel}</label>
            <select
              value={screenQuality}
              onChange={(event) => onScreenQualityChange(event.target.value as "720" | "1080")}
            >
              <option value="720">{labels.quality(720)}</option>
              <option value="1080">{labels.quality(1080)}</option>
            </select>
          </div>
          <div>
            <label>{labels.fps}</label>
            <select
              value={screenFps}
              onChange={(event) => onScreenFpsChange(Number(event.target.value) as 30 | 60)}
            >
              <option value={30}>30 {labels.fps}</option>
              <option value={60}>60 {labels.fps}</option>
            </select>
          </div>
        </div>

        <div className="screen-share-note">
          🖥️ {labels.shareProfile(screenQuality, screenFps)}
          <small>{labels.changeNotice}</small>
        </div>

        <div className="sound-settings-block">
          <label className="sound-toggle-row">
            <span>
              <b>{labels.lobbySounds}</b>
              <small>{labels.lobbySoundsDescription}</small>
            </span>
            <input
              type="checkbox"
              checked={lobbySoundsEnabled}
              onChange={(event) => onLobbySoundsChange(event.target.checked)}
            />
          </label>

          <label>{labels.effectVolume(effectVolume)}</label>
          <input
            type="range"
            min="0"
            max="100"
            value={effectVolume}
            onChange={(event) => onEffectVolumeChange(Number(event.target.value))}
          />
        </div>

        <div className="modal-actions">
          <button onClick={onClose}>{labels.close}</button>
        </div>
      </div>
    </div>
  );
}
