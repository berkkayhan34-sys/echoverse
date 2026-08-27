<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# EchoVerse web

Browser entrypoint. Shared protocol and session behavior comes from
`@echoverse/contracts` and `@echoverse/client-core`; browser builds must not
import Electron or Node APIs.

The renderer-specific `src/features/` modules own browser effects and runtime
commands. Friends/DM actions and audio-device switching receive explicit state
and transport dependencies from `App.tsx`; pure transitions remain in
`client-core`.
