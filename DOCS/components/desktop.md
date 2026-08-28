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

The renderer-specific `src/features/` modules own desktop runtime commands and
their explicit dependencies. Electron-only sound, updater, session, and
capture behavior remains in desktop-owned modules and the preload boundary;
no desktop capability is imported by the web renderer or `client-core`.

Release workflows invoke the packaged executable with
`ECHO_VERSE_SMOKE_TEST=1`. This starts Electron, validates the packaged renderer,
English/Turkish catalogs, and branding resources, then exits without opening a
window or contacting a server.

Updater failures preserve the currently installed version in the visible error
state, clear download progress, and do not invoke installation for rejected
metadata. Binary rollback after an installer failure remains part of the later
public-release readiness gate.
