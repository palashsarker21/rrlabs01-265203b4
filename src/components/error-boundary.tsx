import { Component, type ErrorInfo, type ReactNode } from "react";
import { reportLovableError } from "@/lib/lovable-error-reporting";
import { ErrorStateView } from "@/components/error-state";

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  boundary?: string;
}

interface State {
  error: Error | null;
}

/**
 * Client-side React error boundary. Catches render / lifecycle errors
 * anywhere in the tree below it. Async errors thrown outside React are
 * captured by the global listeners in `src/lib/error-capture.ts`.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info);
    reportLovableError(error, {
      boundary: this.props.boundary ?? "client_error_boundary",
      componentStack: info.componentStack ?? undefined,
    });
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(this.state.error, this.reset);
    return (
      <ErrorStateView
        title="This section couldn't load"
        message="Something went wrong while rendering this page. You can retry or go back home."
        onRetry={this.reset}
      />
    );
  }
}
