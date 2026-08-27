/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { createTranslator, type Locale } from "@echoverse/contracts";

export function utilityBotResponse(command: string, locale: Locale = "tr"): string | null {
  const t = createTranslator(locale);
  switch (command.trim().toLowerCase()) {
    case "!ping":
      return t("bot.pingResponse");
    case "!roll":
      return `🎲 ${Math.floor(Math.random() * 100) + 1}`;
    case "!help":
      return t("bot.helpResponse");
    default:
      return null;
  }
}
