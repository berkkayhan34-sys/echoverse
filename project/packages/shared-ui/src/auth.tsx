/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { ActionButton } from "./primitives.js";

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

/** Shared credential form; authentication behavior remains renderer-owned. */
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
