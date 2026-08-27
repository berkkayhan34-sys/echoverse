<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# Shared UI

Browser-safe React primitives. `ActionButton` standardizes action-only buttons,
`LocaleSelect` renders catalog-provided language labels, and `AuthForm` owns
the shared credential form shape while receiving all catalog values and
authentication behavior from its owner. The package embeds no user-facing
natural-language text. Feature-specific screens stay in the owning application
until extracted behind a documented boundary.
