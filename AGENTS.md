<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# EchoVerse repository instructions

This root file exists so repository-aware tooling discovers the project
instructions. The canonical technical instructions are in
[`DOCS/agent-instructions.md`](DOCS/agent-instructions.md); read that file
before changing the repository.

The repository shape is:

- `DOCS/` — canonical technical documentation, decisions, policies, evidence,
  and procedures;
- `project/` — all application source, packages, tests, assets, migrations,
  configuration, and project-local manifests;
- `tmp/` — ignored generated output, local environments, runtime data, and
  short-lived work files;
- root metadata — `package.json`, `package-lock.json`, `Makefile`, `VERSION`,
  `LICENSE`, `REUSE.toml`, `.github/`, and the product README files.

Do not create application code outside `project/`, technical instructions
outside `DOCS/`, or generated output outside `tmp/` unless an authoritative
tool requires a root metadata file.
