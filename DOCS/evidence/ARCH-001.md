<!-- SPDX-FileCopyrightText: 2026 EchoVerse contributors -->
<!-- SPDX-License-Identifier: GPL-3.0-only -->

# Evidence: `ARCH-001`

```yaml
id: ARCH-001
status: complete
date: 2026-08-29
revision: v1.8.7 / main 84d324f
```

The hybrid Discord/TeamSpeak contract is now explicit in `DOCS/architecture.md`
and ADR-0021. Compatibility aliases remain for the existing text and lobby
rooms. The remaining work is the full client contract matrix and generated
protocol fixtures.

Validation: `npm run typecheck`, focused server integration tests, and roadmap
validation pass.
