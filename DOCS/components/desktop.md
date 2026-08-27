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
