<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# EchoVerse documentation

This directory is the canonical documentation surface for EchoVerse. Product
behavior belongs in the application; decisions, boundaries, validation rules,
and operating procedures belong here.

## Start here

- [Architecture](architecture.md)
- [Target repository structure](architecture/repository-structure.md)
- [Security policy](security-policy.md)
- [Testing policy](testing-policy.md)
- [Development workflow](development.md)
- [Release workflow](release.md)
- [Roadmap](roadmap.md)
- [Decisions](decisions/README.md)
- [Contribution guide](../.github/CONTRIBUTING.md)
- [Security reporting](../.github/SECURITY.md)
- [Changelog](../CHANGELOG.md)
- [Historical notes](historic/README.md)

## Documentation rules

`AGENTS.md` defines the authority order. This index must remain a locator, not
a second copy of architecture or security requirements. Historical version
historical notes remain under [`historic/`](historic/); new permanent guidance
belongs in the canonical documents above and may link to historical notes when
useful.

All documentation is written with implementation status in mind. Planned
behavior uses future/required language; implemented behavior requires code and
validation evidence.
