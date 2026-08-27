/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

export type StateSetter<T> = (value: T | ((previous: T) => T)) => void;
