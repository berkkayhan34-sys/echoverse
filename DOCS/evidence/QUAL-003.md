<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# Evidence: `QUAL-003`

```yaml
id: QUAL-003
status: complete
date: 2026-08-27
revision: 2275254 plus the completing working-tree changes
```

## Scope

- Affected source-of-truth files: server integration fixtures, the dedicated
  database-test configuration, the root test command, the quality workflow,
  the roadmap, and the testing policy.
- Security impact: adds deterministic coverage for safe origin and header
  handling, oversized HTTP and attachment payloads, cross-user DM isolation,
  authentication rate limits, unanswered-call expiry, and production secret
  rejection. No security control was weakened and no secret or personal data
  was added.
- Deferred runtime work: the full hybrid session lifecycle, complete
  feature-by-feature authorization, WebRTC/media depth, artifact checksums,
  installer launch, publisher trust, and rollback remain tracked by later
  roadmap children.

## Validation

| Command or check                                   | Runtime/dependencies                            | Result | Artifacts or notes                                                                                                                                          |
| -------------------------------------------------- | ----------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`                                         | Node.js 26.7.0, Vitest 3.2.7                    | pass   | 8 test files and 32 tests passed, including 10 HTTP/Socket.IO integration cases.                                                                            |
| `npm run typecheck`                                | TypeScript workspace                            | pass   | All workspaces typechecked without errors.                                                                                                                  |
| `npm run format:check`                             | Prettier 3.9.6                                  | pass   | All active repository files match the formatter configuration.                                                                                              |
| `npm run lint`                                     | ESLint 10.9.1, TypeScript ESLint 8.68.0         | pass   | Machine-readable JSON output with zero errors and warnings.                                                                                                 |
| `npm run coverage`                                 | Vitest 3.2.7, V8 provider                       | pass   | Coverage text, JSON summary, and LCOV reports generated.                                                                                                    |
| GitHub Quality Gate #11                            | Node.js 22.23.2, PostgreSQL 16, Ubuntu 24.04    | pass   | Main quality job and PostgreSQL job passed in [run 33027718948](https://github.com/berkkayhan34-sys/echoverse/actions/runs/33027718948).                    |
| `npm run test:db`                                  | GitHub PostgreSQL service, Vitest JSON reporter | pass   | 2 suites and 2 migration/cascade tests passed; database evidence artifact digest `sha256:6ea862d2caef564e129ddb7d68dfe4dccb853bae51bf61b02f02b0be485927c3`. |
| `npm run test:e2e`                                 | GitHub Chromium install, Playwright             | pass   | Browser smoke test passed and was retained in the quality evidence artifact.                                                                                |
| `npm run dependency:check`, `npm audit --omit=dev` | npm audit                                       | pass   | No blocking vulnerabilities reported by CI.                                                                                                                 |
| `npm run build`                                    | Vite 8.2.2, TypeScript workspace                | pass   | Desktop/web bundles and shared package builds completed in CI.                                                                                              |
| `make ai-check`                                    | Repository metadata and documentation gate      | pass   | Roadmap, evidence, links, metadata, and repository boundary checks passed.                                                                                  |

## Review notes

The database job initially failed because the root Vitest configuration did not
include the explicitly targeted `*.dbtest.ts` file; it reported zero suites.
`vitest.db.config.ts` now isolates database discovery from the ordinary
database-free test command. The subsequent GitHub run passed both database
assertions and the full quality job. Release-blocking failures remain visible:
only the evidence-upload steps use `if: always()`, and no test or security step
uses `continue-on-error` or a skip condition.
