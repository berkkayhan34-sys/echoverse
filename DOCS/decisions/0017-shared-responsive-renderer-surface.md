<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# ADR-0017: shared responsive renderer surface

## Status

Accepted for all client surfaces from version 1.8.2 onward.

## Decision

Web, desktop, and mobile are one product surface. The shared React workspace
and visual contract are the source of truth for navigation, server/channel
selection, direct messages, lobby entry, settings, and responsive layout.
Desktop and web may keep only their platform-specific effects and bridges;
mobile is the responsive presentation of the web surface, not a second product
with separate interaction rules or components.

Responsive behavior must be validated at desktop and narrow touch breakpoints.
Controls remain keyboard-accessible, touch-sized, localized, and visually
consistent. Actions that cannot use hover on touch layouts must remain
discoverable through a visible control or focus state.

## Consequences

- Feature work must start in `project/packages/shared-ui` when it changes
  product-visible layout or interaction.
- Renderer-specific code may provide commands, transport, media, and native
  integration, but must not fork shared navigation or styling.
- A client change is incomplete until web, desktop, and responsive-mobile
  builds/tests use the same shared contract.
- Desktop-sized lobby rows reveal the authorized rename action on hover/focus;
  touch-sized rows keep the same action visible because hover is unavailable.

## Validation

Every shared-surface change requires typecheck, lint, formatting, shared UI
tests, web/desktop production builds, and an integrated-browser inspection at
both the default viewport and a narrow mobile viewport with no horizontal
overflow.
