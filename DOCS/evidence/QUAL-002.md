<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# Evidence: `QUAL-002`

```yaml
id: QUAL-002
status: complete
date: 2026-08-27
revision: working tree (uncommitted)
```

## Scope

- Affected source-of-truth files: shared contracts, server validation tests,
  configuration tests, browser-safe client-core adapter tests, and the testing
  and contracts documentation.
- Security impact: adds strict rejection fixtures for unsupported protocol
  versions, oversized/malformed payloads, unsafe extra fields, invalid
  signaling, and malformed persisted session state.
- Deferred runtime work: server authorization/IDOR and rate-limit integration,
  Playwright CI execution, and release evidence remain tracked by `QUAL-003`
  and later children.

## Validation

| Command or check       | Runtime/dependencies                    | Result | Artifacts or notes                                                                              |
| ---------------------- | --------------------------------------- | ------ | ----------------------------------------------------------------------------------------------- |
| `npm test`             | Vitest 3.2.7                            | pass   | 6 test files and 20 tests passed.                                                               |
| `npm run typecheck`    | TypeScript workspace                    | pass   | Server and all shared packages typechecked without errors.                                      |
| `npm run coverage`     | Vitest 3.2.7, V8 provider               | pass   | Coverage reports generated for the expanded contract, validator, config, and client-core tests. |
| `npm run format:check` | Prettier 3.9.6                          | pass   | All active repository files match the pinned formatter configuration.                           |
| `npm run lint`         | ESLint 10.9.1, TypeScript ESLint 8.68.0 | pass   | Machine-readable JSON output; zero errors and zero warnings.                                    |
| `make ai-check`        | Node.js 26.7.0, repository metadata     | pass   | Roadmap and evidence ordering, links, metadata, and repository policies verified.               |

## Review notes

The shared contracts package now provides strict reusable schemas for protocol
readiness, safe errors, pagination, attachment metadata, and WebRTC offer,
answer, and ICE payloads. Web and desktop consume the same package, and the
compatibility fixture parses both outbound and forwarded signaling shapes.
Reducers/selectors that do not yet exist in the current runtime are not
invented in this foundation slice; existing client adapter and server boundary
logic are covered while feature-state coverage remains part of later runtime
work. No commit, push, release, deploy, or external setting change was
performed.
