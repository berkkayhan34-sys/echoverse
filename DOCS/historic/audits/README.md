<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# Historical audit records

This directory contains immutable records of completed temporary roadmap
audits. Archived records must retain the audit ID, use `status: archived`,
identify their `archived_from` path, and link to completed evidence.

New audit work belongs in [`../../audits/`](../../audits/README.md). Do not
edit an archived record to reflect later work; create a new audit record and
evidence instead. The roadmap/status validator checks the archive lifecycle
and prevents duplicate IDs across active and historical audits.
