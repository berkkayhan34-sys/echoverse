/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

export function utilityBotResponse(command: string): string | null {
  switch (command.trim().toLowerCase()) {
    case "!ping": return "Pong 🏓";
    case "!roll": return `🎲 ${Math.floor(Math.random() * 100) + 1}`;
    case "!help": return "Komutlar: !ping, !roll, !help";
    default: return null;
  }
}
