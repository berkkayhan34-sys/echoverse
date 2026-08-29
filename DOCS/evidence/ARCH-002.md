<!-- SPDX-FileCopyrightText: 2026 EchoVerse contributors -->
<!-- SPDX-License-Identifier: GPL-3.0-only -->

# Evidence: `ARCH-002`

```yaml
id: ARCH-002
status: in_progress
date: 2026-08-29
revision: v1.8.7 / main 84d324f
```

Migration `008_spaces_channels_messages.sql` (PostgreSQL and SQLite) adds
categories, ordered text/voice/stage/forum channels, archive state, and
durable guild messages. Deterministic `general` and `Lobby` channels preserve
legacy clients; channel CRUD is exposed through validated socket events.

Remaining work: category CRUD/reordering UI and full PostgreSQL migration-runner
evidence. The roadmap remains incomplete until those acceptance gates pass.
