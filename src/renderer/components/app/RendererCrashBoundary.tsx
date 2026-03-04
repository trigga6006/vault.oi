import { Component, type ErrorInfo, type ReactNode } from 'react';

interface RendererCrashBoundaryProps {
  children: ReactNode;
}

interface RendererCrashBoundaryState {
  error: Error | null;
}

export class RendererCrashBoundary extends Component<
  RendererCrashBoundaryProps,
  RendererCrashBoundaryState
> {
  state: RendererCrashBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): RendererCrashBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Renderer] Uncaught render error:', error, info);
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background p-6">
        <div className="glass-strong w-full max-w-xl rounded-[28px] border border-white/8 p-6">
          <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
            renderer.crash
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-foreground">
            The UI failed to render
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            OmniView hit a renderer error. The message below is the current failure instead of a blank window.
          </p>
          <pre className="mt-4 overflow-auto rounded-2xl border border-white/8 bg-black/20 p-4 text-xs text-foreground">
            {this.state.error.stack ?? this.state.error.message}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-2xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Reload renderer
          </button>
        </div>
      </div>
    );
  }
}
