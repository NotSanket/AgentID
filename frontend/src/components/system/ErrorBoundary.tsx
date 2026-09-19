import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props { children: ReactNode }
interface State { failed: boolean }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) console.error("AgentID interface error", error, info);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="recovery-screen">
        <div className="recovery-card" role="alert">
          <span className="icon-frame danger"><AlertTriangle aria-hidden="true" /></span>
          <p className="eyebrow">Interface recovery</p>
          <h1>The console hit an unexpected fault.</h1>
          <p>Your AgentID data was not changed. Reload the interface to restore this session.</p>
          <button className="button button-primary" type="button" onClick={() => window.location.reload()}>
            <RefreshCw size={16} aria-hidden="true" /> Reload console
          </button>
        </div>
      </main>
    );
  }
}
