<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# Evidence: `CODE-002`

```yaml
id: CODE-002
status: complete
date: 2026-08-27
revision: working tree (pending publication)
```

## Scope

- Affected source-of-truth files: protocol contracts, server transport and
  integration boundaries, runtime limit helpers, Electron provider/updater
  boundaries, and the security policy.
- Security impact: every registered Socket.IO event now has a strict payload
  schema; malformed packets stop before handler execution, persistence, or
  relay; attachment MIME types and data-URL headers must agree; HTTP and
  Socket.IO size/rate/time budgets remain enforced; updater metadata and
  progress values are validated before display, logging, or install state;
  provider and server error paths return stable non-sensitive messages.
- Deferred runtime work: media cleanup/regression coverage belongs to CODE-007;
  durable persistence and deletion/backup behavior belongs to CODE-003; full
  structured diagnostics and retention controls belong to OPS-001.

## Validation

| Command or check    | Result | Evidence                                                                                                       |
| ------------------- | ------ | -------------------------------------------------------------------------------------------------------------- |
| `npm test`          | pass   | 10 test files and 45 tests passed, including all event-schema, updater, HTTP, Socket.IO, and safe-error cases. |
| `npm run typecheck` | pass   | All TypeScript workspaces typechecked without errors.                                                          |
| `npm run lint`      | pass   | ESLint completed with machine-readable output and no reported findings.                                        |
| `git diff --check`  | pass   | No whitespace errors in the working-tree implementation diff.                                                  |

## Review notes

The shared attachment policy currently allows PNG, JPEG, WebP, GIF, plain text,
CSV, JSON, PDF, and ZIP files. The server does not log request payloads,
credentials, cookies, tokens, message bodies, media, or raw provider errors.
The updater accepts only bounded semantic versions and finite progress values;
publisher signing and artifact provenance remain release-security work under
OPS-003 and are not claimed by this child.
