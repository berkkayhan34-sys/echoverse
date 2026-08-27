/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import englishCatalog from "./localizations/en.json" with { type: "json" };
import turkishCatalog from "./localizations/tr.json" with { type: "json" };

export const supportedLocales = ["en", "tr"] as const;
export type Locale = (typeof supportedLocales)[number];

export const localeCatalogs = { en: englishCatalog, tr: turkishCatalog } as const;
export type CatalogKey = keyof typeof englishCatalog;

/** Resolve the supported catalog from an arbitrary browser or request locale. */
export function resolveLocale(value: unknown): Locale {
  if (typeof value !== "string") return "en";
  const language = value.trim().toLowerCase().split(/[-_]/u, 1)[0];
  return language === "tr" ? "tr" : "en";
}

/** Return the future-safe writing direction associated with a locale. */
export function localeDirection(_locale: Locale): "ltr" {
  return "ltr";
}

/** Build a translator with deterministic English fallback for missing keys. */
export function createTranslator(locale: Locale, fallback: Locale = "en") {
  return (key: CatalogKey | string, values: Record<string, string | number> = {}) => {
    const message =
      localeCatalogs[locale][key as CatalogKey] ||
      localeCatalogs[fallback][key as CatalogKey] ||
      `[${key}]`;
    return message.replace(/\{\{(\w+)\}\}/g, (placeholder, name: string) =>
      Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : placeholder
    );
  };
}

/** Format a timestamp with the user's selected locale conventions. */
export function formatLocaleDate(value: Date | number | string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

/** Format a number with the user's selected locale conventions. */
export function formatLocaleNumber(value: number, locale: Locale) {
  return new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US").format(value);
}
