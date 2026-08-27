/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import type { StateSetter } from "./types";

export type AudioDevicesFeatureDeps = {
  localStream: { current: MediaStream | null };
  peerConnections: { current: Map<string, RTCPeerConnection> };
  remoteAudio: { current: Map<string, HTMLAudioElement> };
  getMuted: () => boolean;
  setSelectedInput: (deviceId: string) => void;
  setSelectedOutput: (deviceId: string) => void;
  setAudioInputs: StateSetter<MediaDeviceInfo[]>;
  setAudioOutputs: StateSetter<MediaDeviceInfo[]>;
  setVideoInputs: StateSetter<MediaDeviceInfo[]>;
  startSpeakingMonitor: (peerId: string, stream: MediaStream) => void;
};

export function createAudioDevicesFeature(deps: AudioDevicesFeatureDeps) {
  async function refreshAudioDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      deps.setAudioInputs(devices.filter((device) => device.kind === "audioinput"));
      deps.setAudioOutputs(devices.filter((device) => device.kind === "audiooutput"));
      deps.setVideoInputs(devices.filter((device) => device.kind === "videoinput"));
    } catch {
      // Device enumeration is optional and may be denied by the browser.
    }
  }

  async function switchInput(deviceId: string) {
    deps.setSelectedInput(deviceId);
    localStorage.setItem("echoverse_input_device", deviceId);

    const old = deps.localStream.current;
    const next = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1
      },
      video: false
    });

    const newTrack = next.getAudioTracks()[0];
    if (!newTrack) {
      next.getTracks().forEach((track) => track.stop());
      throw new Error("media.audioTrackMissing");
    }
    newTrack.enabled = !deps.getMuted();

    for (const peerConnection of deps.peerConnections.current.values()) {
      const sender = peerConnection.getSenders().find((item) => item.track?.kind === "audio");
      if (sender) await sender.replaceTrack(newTrack);
    }

    old?.getAudioTracks().forEach((track) => track.stop());
    deps.localStream.current = next;
    deps.startSpeakingMonitor("local", next);
  }

  async function switchOutput(deviceId: string) {
    deps.setSelectedOutput(deviceId);
    localStorage.setItem("echoverse_output_device", deviceId);

    for (const audio of deps.remoteAudio.current.values()) {
      const sinkable = audio as HTMLAudioElement & {
        setSinkId?: (id: string) => Promise<void>;
      };

      if (sinkable.setSinkId) {
        try {
          await sinkable.setSinkId(deviceId);
        } catch {
          // A browser may reject output routing for an individual element.
        }
      }
    }
  }

  return { refreshAudioDevices, switchInput, switchOutput };
}
