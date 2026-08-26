<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# EchoVerse server

HTTP and Socket.IO composition for the modular monolith. Feature code is
organized under `src/features`, boundary validation under `src/domain`, and
database migrations under `db/migrations`.

Run `npm run dev` from this directory or `make server-run` from the repository
root. Production requires `JWT_SECRET` and an explicit `CORS_ORIGINS` value.
