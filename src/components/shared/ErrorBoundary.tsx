import { Component, type ReactNode } from 'react';

interface FallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode | ((props: FallbackProps) => ReactNode);
  onReset?: () => void;
  resetKeys?: unknown[];
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[ErrorBoundary]', error);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.state.error === null) return;
    if (!this.props.resetKeys || !prevProps.resetKeys) return;

    const changed = this.props.resetKeys.some(
      (key, i) => key !== prevProps.resetKeys![i]
    );
    if (changed) this.resetErrorBoundary();
  }

  resetErrorBoundary = () => {
    this.props.onReset?.();
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (error !== null) {
      const { fallback } = this.props;
      if (typeof fallback === 'function') {
        return fallback({ error, resetErrorBoundary: this.resetErrorBoundary });
      }
      return fallback;
    }
    return this.props.children;
  }
}

export function RootFallback({ error }: { error: Error }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        width: '100vw',
        background: '#121212',
        color: 'rgba(255, 255, 255, 0.92)',
        fontFamily: 'Satoshi, system-ui, sans-serif',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <p
        style={{
          fontSize: '0.875rem',
          fontWeight: 700,
          letterSpacing: '0.18em',
          textTransform: 'uppercase' as const,
          marginBottom: '1.5rem',
          opacity: 0.45,
        }}
      >
        INKED
      </p>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 500, marginBottom: '0.5rem' }}>
        Something went wrong
      </h1>
      <p
        style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '0.75rem',
          opacity: 0.45,
          maxWidth: '32rem',
          marginBottom: '1.5rem',
          wordBreak: 'break-word',
        }}
      >
        {error.message}
      </p>
      <button
        onClick={() => window.location.reload()}
        style={{
          background: '#C83C2F',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          padding: '0.5rem 1.25rem',
          fontSize: '0.8125rem',
          fontFamily: 'Satoshi, system-ui, sans-serif',
          fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        Reload
      </button>
    </div>
  );
}

export function ModeFallback({
  error,
  resetErrorBoundary,
}: {
  error: Error;
  resetErrorBoundary: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <p className="text-sm font-medium text-text-primary">This view hit a problem</p>
      <p className="max-w-md break-words font-mono text-xs text-text-muted">
        {error.message}
      </p>
      <button
        onClick={resetErrorBoundary}
        className="mt-2 rounded-md bg-accent-warm px-4 py-2 text-sm font-medium text-white hover:bg-accent-warm-hover transition-colors"
      >
        Back to planning
      </button>
    </div>
  );
}
