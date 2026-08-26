<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# EchoVerse desktop

Electron shell and renderer. Native lifecycle, updater, capture, and
filesystem access remain behind `electron/preload.cjs`; renderer code uses
the shared browser-safe packages.
