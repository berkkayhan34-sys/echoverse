<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# Active audits

This directory contains temporary roadmap audit records only. An active audit
uses a Markdown file with metadata like:

```yaml
id: AUDIT-001
status: active
evidence: null
```

An audit may block the ordinary roadmap sequence. When its evidence is
complete, update its record with a non-null evidence path, move it to
[`../historic/audits/`](../historic/audits/README.md), and set
`status: archived` plus `archived_from: audits/<filename>`. The active copy
must not remain after archiving. The roadmap/status validator enforces these
locations, statuses, evidence links, and unique audit IDs.

Do not use this directory for permanent policy, implementation status, or
ordinary evidence records.
