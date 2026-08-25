import React from "react";

type Props = { children: React.ReactNode };
type State = { error: Error | null };

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[EchoVerse UI crash]", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="fatal-error-screen">
        <div className="fatal-error-card">
          <div className="fatal-error-mark">!</div>
          <h1>EchoVerse toparlanamadı</h1>
          <p>Arayüzde beklenmeyen bir hata oluştu. Uygulamayı yeniden yükleyebilirsin.</p>
          <button onClick={() => window.location.reload()}>Yeniden yükle</button>
          <details>
            <summary>Teknik detay</summary>
            <pre>{this.state.error.message}</pre>
          </details>
        </div>
      </div>
    );
  }
}
