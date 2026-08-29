<!-- SPDX-FileCopyrightText: 2026 EchoVerse contributors -->
<!-- SPDX-License-Identifier: GPL-3.0-only -->

# Evidence: `ARCH-002`

```yaml
id: ARCH-002
status: complete
date: 2026-08-29
revision: v1.8.9
```

Migration `008_spaces_channels_messages.sql` (PostgreSQL and SQLite) adds
categories, ordered text/voice/stage/forum channels, archive state, and
durable guild messages. Deterministic `general` and `Lobby` channels preserve
legacy clients; channel CRUD is exposed through validated socket events.

Migration `009_guild_governance` preserves category/channel ordering and adds
scope tables used by the server evaluator. Socket contracts expose category
CRUD, channel/category reordering, archive state, and member-visible channel
updates; SQLite migration tests cover the complete ordered migration history.
