/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { describe, expect, it } from "vitest";
import {
  createTranslator,
  formatLocaleDate,
  formatLocaleNumber,
  localeCatalogs,
  localeDirection,
  resolveLocale,
  supportedLocales
} from "./localization.js";

describe("JSON locale catalogs", () => {
  it("keeps English and Turkish keys and placeholders aligned", () => {
    expect(Object.keys(localeCatalogs.en).sort()).toEqual(Object.keys(localeCatalogs.tr).sort());
    for (const key of Object.keys(localeCatalogs.en) as Array<keyof typeof localeCatalogs.en>) {
      const placeholders = (value: string) =>
        [...value.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();
      expect(placeholders(localeCatalogs.tr[key])).toEqual(placeholders(localeCatalogs.en[key]));
    }
  });

  it("selects deterministically, falls back safely, and preserves Unicode", () => {
    expect(supportedLocales).toEqual(["en", "tr"]);
    expect(resolveLocale("tr-TR")).toBe("tr");
    expect(resolveLocale("ja-JP")).toBe("en");
    expect(createTranslator("tr")("auth.login")).toBe("Giriş yap");
    expect(createTranslator("en")("unknown.key")).toBe("[unknown.key]");
    expect(createTranslator("en")("message.{{value}}", { value: "ı̆🙂漢字" })).toBe(
      "[message.ı̆🙂漢字]"
    );
    expect(localeDirection("en")).toBe("ltr");
  });

  it("uses locale-aware number and date formatting", () => {
    expect(formatLocaleNumber(1234567.89, "en")).toContain(",");
    expect(formatLocaleNumber(1234567.89, "tr")).toContain(".");
    expect(formatLocaleDate("2026-08-27T12:34:00Z", "en")).toBeTruthy();
    expect(formatLocaleDate("2026-08-27T12:34:00Z", "tr")).toBeTruthy();
  });
});
