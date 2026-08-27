<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# Evidence records

Evidence records are short, reproducible records of validation for a roadmap
child. They do not replace the child status in [`../roadmap.md`](../roadmap.md)
and must describe what was actually checked at a stated revision.

Use [`template.md`](template.md) for new records. Store one record per child,
use the child ID in the filename, and link the record from the child metadata
with a path relative to `DOCS/`, such as `evidence/DOC-001.md`.

Each record must identify the date, revision or working-tree state, commands
and results, affected source-of-truth documents, security impact, and any
deferred runtime work. A completed roadmap child requires a non-null evidence
link to an existing record.
