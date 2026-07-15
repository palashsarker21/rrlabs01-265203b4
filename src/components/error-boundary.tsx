import { Component, type ErrorInfo, type ReactNode } from "react";
import { reportLovableError } from "@/lib/lovable-error-reporting";
import { ErrorStateView } from "@/components/error-state";
import { DebugErrorPanel } from "@/components/debug-error-panel";
import { isDebugMode } from "@/lib/debug-mode";

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  boundary?: string;
}

interface State {
  error: Error | null;
  componentStack?: string;
}

/**
 * Client-side React error boundary. Catches render / lifecycle errors
 * anywhere in the tree below it. In debug mode it renders the full
 * DebugErrorPanel (stack, file:line, request/response, Supabase codes,
 * etc.). Async errors thrown outside React are captured by the global
 * listeners in `src/lib/error-capture.ts` + `GlobalDebugOverlay`.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[RRLabs ${this.props.boundary ?? "boundary"}]`, error, info);
    this.setState({ componentStack: info.componentStack ?? undefined });
    reportLovableError(error, {
      boundary: this.props.boundary ?? "client_error_boundary",
      componentStack: info.componentStack ?? undefined,
    });
  }

  reset = () => this.setState({ error: null, componentStack: undefined });

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(this.state.error, this.reset);
    if (isDebugMode()) {
      return (
        <DebugErrorPanel
          error={this.state.error}
          componentStack={this.state.componentStack}
          boundary={this.props.boundary}
          onRetry={this.reset}
        />
      );
    }
    return (
      <ErrorStateView
        title="This section couldn't load"
        message="Something went wrong while rendering this page. You can retry or go back home."
        onRetry={this.reset}
      />
    );
  }
}
