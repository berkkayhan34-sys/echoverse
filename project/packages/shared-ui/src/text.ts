/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

/**
 * Returns at most two user-perceived characters without splitting emoji or
 * combining sequences used in usernames and guild names.
 */
export function displayInitials(value: string) {
  return Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(value))
    .slice(0, 2)
    .map(({ segment }) => segment)
    .join("")
    .toUpperCase();
}
