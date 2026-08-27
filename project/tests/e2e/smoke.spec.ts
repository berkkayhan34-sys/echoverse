/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { expect, test } from "@playwright/test";

test("web shell renders", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/EchoVerse/i);
});

test.describe("web locale selection", () => {
  for (const scenario of [
    { locale: "en", submitLabel: "Sign in", tagline: "Talk, chat, and watch with your friends." },
    { locale: "tr", submitLabel: "Giriş Yap", tagline: "Arkadaşlarınla konuş, yazış, izle." }
  ]) {
    test(`${scenario.locale} renders the selected catalog`, async ({ page }) => {
      await page.addInitScript((locale) => {
        window.localStorage.setItem("echoverse_locale", locale);
      }, scenario.locale);
      await page.goto("/");

      await expect(page.locator("html")).toHaveAttribute("lang", scenario.locale);
      await expect(page.getByText(scenario.tagline, { exact: true })).toBeVisible();
      await expect(page.locator("button.primary", { hasText: scenario.submitLabel })).toBeVisible();
    });
  }
});
