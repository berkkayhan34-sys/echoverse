import React from "react";
import { createTranslator, resolveLocale } from "@echoverse/contracts";

type Props = { children: React.ReactNode };
type State = { error: Error | null };

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[echoverse.ui_crash]", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const t = createTranslator(resolveLocale(localStorage.getItem("echoverse_locale")));

    return (
      <div className="fatal-error-screen">
        <div className="fatal-error-card">
          <div className="fatal-error-mark">!</div>
          <h1>{t("fatal.title")}</h1>
          <p>{t("fatal.description")}</p>
          <button onClick={() => window.location.reload()}>{t("fatal.reload")}</button>
          <details>
            <summary>{t("fatal.details")}</summary>
            <pre>{this.state.error.message}</pre>
          </details>
        </div>
      </div>
    );
  }
}
