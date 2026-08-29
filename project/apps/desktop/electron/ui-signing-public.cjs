/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

// Public half of the Ed25519 key used to verify signed UI manifests.
// The private half exists only as the ECHO_VERSE_UI_SIGNING_KEY CI secret.
module.exports = {
  algorithm: "ed25519",
  publicKeyDerBase64: "MCowBQYDK2VwAyEA4pOGbJifyxsdmc+kpzWjfCbk8ojrlYQXoD5hHYpGrC4="
};
