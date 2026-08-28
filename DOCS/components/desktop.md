<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# EchoVerse desktop

Electron shell and renderer. Native lifecycle, updater, capture, and
filesystem access remain behind `electron/preload.cjs`. The preload module
exposes the fixed browser-safe API built by `electron/bridge.cjs`; it does not
expose `ipcRenderer` or arbitrary IPC access. Renderer code uses the shared
browser-safe packages.

The packaged preload is bundled from `electron/preload.cjs` and
`electron/bridge.cjs` into a single sandbox-compatible file during the desktop
build. This keeps the renderer sandbox enabled while preserving the fixed
bridge surface. The renderer-specific `src/features/` modules own desktop runtime commands and
their explicit dependencies. Electron-only sound, updater, session, and
capture behavior remains in desktop-owned modules and the preload boundary;
no desktop capability is imported by the web renderer or `client-core`.

Named call, voice, screen-share, mention, message, microphone, and deafen
effects are packaged under `public/sounds` and played by the renderer through
the browser-safe audio API. The web renderer receives the same sound set under
its own `public/sounds` path; mobile web therefore uses the responsive web
implementation rather than a native audio bridge.

Release workflows invoke the packaged executable with
`ECHO_VERSE_SMOKE_TEST=1`. This starts Electron, validates the packaged renderer,
English/Turkish catalogs, and branding resources, then exits without opening a
window or contacting a server.

Updater failures preserve the currently installed version in the visible error
state, clear download progress, and do not invoke installation for rejected
metadata. Binary rollback after an installer failure remains part of the later
public-release readiness gate.

Packaged desktop builds configure `electron-updater` for an unattended startup
gate. Before the tray, splash screen, or main window is created, EchoVerse
checks the matching GitHub Release and automatically downloads an available
update. Once the package is verified and complete, the app calls
`quitAndInstall(true, true)` and does not show the NSIS installer UI. The
updater passes the package's `isAdminRightsRequired` metadata through to the
installer and reuses the existing install directory, so a per-user or
per-machine installation keeps its established scope. If checking or
downloading exceeds the bounded startup timeout, the current known-good
version opens and the failure remains visible in updater state; a completed
download can still trigger the same silent install while the app is running.
For a machine-wide installation, Windows may still require its standard UAC
consent; the updater does not bypass that operating-system security control.
