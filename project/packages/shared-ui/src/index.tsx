/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

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

/**
 * Shared language selector. Labels are supplied by the active catalog so this
 * primitive contains no user-facing language text or renderer assumptions.
 */
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

export type AuthFormLabels = {
  login: string;
  register: string;
  username: string;
  usernamePlaceholder: string;
  email: string;
  emailPlaceholder: string;
  password: string;
  passwordPlaceholder: string;
  wait: string;
  submitLogin: string;
  submitRegister: string;
};

/**
 * Shared credential form. The owning renderer supplies catalog values and
 * authentication behavior; this component owns only the common form shape.
 */
export function AuthForm({
  mode,
  labels,
  connected,
  busy,
  username,
  email,
  password,
  onModeChange,
  onUsernameChange,
  onEmailChange,
  onPasswordChange,
  onSubmit
}: {
  mode: "login" | "register";
  labels: AuthFormLabels;
  connected: boolean;
  busy: boolean;
  username: string;
  email: string;
  password: string;
  onModeChange: (mode: "login" | "register") => void;
  onUsernameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <>
      <div className="auth-tabs">
        <button onClick={() => onModeChange("login")} className={mode === "login" ? "active" : ""}>
          {labels.login}
        </button>
        <button
          onClick={() => onModeChange("register")}
          className={mode === "register" ? "active" : ""}
        >
          {labels.register}
        </button>
      </div>

      {mode === "register" && (
        <>
          <label>{labels.username}</label>
          <input
            value={username}
            maxLength={28}
            onChange={(event) => onUsernameChange(event.target.value)}
            placeholder={labels.usernamePlaceholder}
          />
        </>
      )}

      <label>{labels.email}</label>
      <input
        type="email"
        value={email}
        onChange={(event) => onEmailChange(event.target.value)}
        placeholder={labels.emailPlaceholder}
      />

      <label>{labels.password}</label>
      <input
        type="password"
        value={password}
        onChange={(event) => onPasswordChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") onSubmit();
        }}
        placeholder={labels.passwordPlaceholder}
      />

      <ActionButton className="primary" onClick={onSubmit} disabled={!connected || busy}>
        {busy ? labels.wait : mode === "register" ? labels.submitRegister : labels.submitLogin}
      </ActionButton>
    </>
  );
}
