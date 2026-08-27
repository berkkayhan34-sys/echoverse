/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

export function sanitizeName(value: unknown, max = 28) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, max);
}

export function sanitizeEmail(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .slice(0, 160);
}

export function sanitizeText(value: unknown) {
  return String(value ?? "")
    .trim()
    .slice(0, 2500);
}

export function validEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
