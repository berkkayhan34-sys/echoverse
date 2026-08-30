<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# Evidence: `QUAL-001`

```yaml
id: QUAL-001
status: complete
date: 2026-08-30
revision: working-tree (codex/parity-wave-1)
```

## Scope

- Affected source-of-truth files: root package manifest and lockfile, Makefile,
  quality workflow, formatter/linter/Vitest configuration, development
  requirements, REUSE license inventory, and canonical testing policy.
- Security impact: adds fail-closed dependency and secret scanning gates;
  no security control was weakened and no secret or personal data was added.
- Deferred runtime work: contract expansion, integration/security tests, E2E
  execution in CI, and release evidence remain tracked by later children.

## Validation

| Command or check            | Runtime/dependencies                    | Result                       | Artifacts or notes                                                                                                                                   |
| --------------------------- | --------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `make ai-check`             | Node.js 26.7.0, npm workspace           | pass                         | Roadmap, evidence, navigation, audit lifecycle, Render policy, tooling policy, metadata, and documentation inventory verified.                       |
| `npm run format:check`      | Prettier 3.9.6                          | pass                         | All active repository files match the pinned formatter configuration.                                                                                |
| `npm run lint`              | ESLint 10.9.1, TypeScript ESLint 8.68.0 | pass                         | JSON output; zero errors and zero warnings.                                                                                                          |
| `npm run dependency:check`  | npm audit                               | pass                         | No high-severity vulnerabilities found.                                                                                                              |
| `make reuse-check`          | REUSE 6.2.0, charset-normalizer 3.4.3   | pass                         | REUSE 3.3 compliance; 328 files have license and copyright information.                                                                              |
| `npm run typecheck`         | TypeScript workspace                    | pass                         | Server and all shared packages typechecked without errors.                                                                                           |
| `npm test`                  | Vitest 3.2.7                            | pass                         | 4 test files and 9 tests passed.                                                                                                                     |
| `npm run coverage`          | Vitest 3.2.7, V8 provider               | pass                         | Text, JSON summary, and LCOV reports generated under ignored `tmp/coverage/`.                                                                        |
| `npm run build`             | Vite 8.2.2, TypeScript workspace        | pass                         | Desktop/web bundles and shared package builds completed.                                                                                             |
| Quality workflow inspection | GitHub Actions, Node.js 22              | pass                         | Root `npm ci`, Node 22, formatter, linter, dependency audit, coverage, immutable REUSE action pin, and immutable Gitleaks action pin are configured. |
| `make tooling-check`        | Local Node.js 26.7.0                    | expected environment failure | Correctly fails closed because the repository requires Node.js 22 LTS.                                                                               |
| `make secret-scan`          | Gitleaks 8.30.1                         | pass                         | Official Windows binary scanned 126 commits and found no leaks.                                                                                      |

## Review notes

The root workspace now installs from `package-lock.json` with `npm ci`, while
the Windows installer script also resolves the repository root and enforces
Node.js 22 before installation. The generated `LICENSES/GPL-3.0-only.txt`
completes the repository's existing REUSE declarations. No commit, push,
release, deploy, or external setting change was performed.
