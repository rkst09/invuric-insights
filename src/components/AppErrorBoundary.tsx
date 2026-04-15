import { Component, type ErrorInfo, type ReactNode } from "react";

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
};

export default class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Application render error", error, info);
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background">
          <div className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-6">
            <div className="w-full max-w-md rounded-3xl border border-border bg-card/80 p-8 text-center shadow-[0_20px_80px_rgba(0,0,0,0.18)] backdrop-blur">
              <p className="font-mono-label text-[11px] tracking-[0.24em] text-primary">INVURIC</p>
              <h1 className="mt-3 text-xl font-semibold text-foreground">Something went wrong</h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                The app hit an unexpected rendering issue. Refresh to restore the workspace.
              </p>
              <button
                onClick={this.handleReload}
                className="mt-6 inline-flex items-center rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
              >
                Reload App
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
