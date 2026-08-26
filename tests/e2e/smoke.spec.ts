/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { expect, test } from "@playwright/test";

test("web shell renders", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/EchoVerse/i);
});
