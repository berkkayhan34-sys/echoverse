/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { type ButtonHTMLAttributes, type PropsWithChildren } from "react";

export type LocaleOption = {
  value: string;
  label: string;
};

export function ActionButton({
  children,
  ...props
}: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>>) {
  return (
    <button type="button" {...props}>
      {children}
    </button>
  );
}

/** Shared language selector; labels and options come from the active catalog. */
export function LocaleSelect({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: LocaleOption[];
  onChange: (value: string) => void;
}) {
  return (
    <label>
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
