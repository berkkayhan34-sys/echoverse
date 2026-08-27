/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

export type ScreenQuality = "720" | "1080";
export type ScreenFps = 30 | 60;

/** Formats elapsed call time without depending on a renderer or locale. */
export function formatCallTime(total: number) {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Computes the one audio-track invariant shared by mute, deafen, and
 * push-to-talk controls. A disabled control must never re-enable the track.
 */
export function isLocalAudioEnabled(
  muted: boolean,
  deafened: boolean,
  pushToTalk: boolean,
  pushToTalkPressed: boolean
): boolean {
  return !muted && !deafened && (!pushToTalk || pushToTalkPressed);
}

/** Builds the bounded display-capture constraints used by both renderers. */
export function createScreenVideoConstraints(quality: ScreenQuality, fps: ScreenFps) {
  const size = quality === "1080" ? 1920 : 1280;
  const height = quality === "1080" ? 1080 : 720;
  return {
    width: { ideal: size },
    height: { ideal: height },
    frameRate: { ideal: fps, max: fps }
  };
}
