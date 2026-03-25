// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useState } from 'react';
import { ErrorBoundary } from './ErrorBoundary';

// Helper that throws on render when `shouldThrow` is true
function ThrowingChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('Boom');
  return <div>child content</div>;
}

// Suppress React error boundary console noise in tests
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
});

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <ErrorBoundary fallback={<div>fallback</div>}>
        <div>hello</div>
      </ErrorBoundary>
    );
    expect(screen.getByText('hello')).toBeDefined();
  });

  it('renders static fallback on error', () => {
    render(
      <ErrorBoundary fallback={<div>something broke</div>}>
        <ThrowingChild shouldThrow />
      </ErrorBoundary>
    );
    expect(screen.getByText('something broke')).toBeDefined();
    expect(screen.queryByText('child content')).toBeNull();
  });

  it('renders function fallback with error and reset', () => {
    render(
      <ErrorBoundary
        fallback={({ error, resetErrorBoundary }) => (
          <div>
            <span>{error.message}</span>
            <button onClick={resetErrorBoundary}>retry</button>
          </div>
        )}
      >
        <ThrowingChild shouldThrow />
      </ErrorBoundary>
    );
    expect(screen.getByText('Boom')).toBeDefined();
    expect(screen.getByText('retry')).toBeDefined();
  });

  it('calls onReset and clears error when resetErrorBoundary is invoked', () => {
    const onReset = vi.fn();

    function Wrapper() {
      const [shouldThrow, setShouldThrow] = useState(true);
      return (
        <ErrorBoundary
          fallback={({ resetErrorBoundary }) => (
            <button onClick={() => { setShouldThrow(false); resetErrorBoundary(); }}>
              recover
            </button>
          )}
          onReset={onReset}
        >
          <ThrowingChild shouldThrow={shouldThrow} />
        </ErrorBoundary>
      );
    }

    render(<Wrapper />);
    fireEvent.click(screen.getByText('recover'));
    expect(onReset).toHaveBeenCalledOnce();
    expect(screen.getByText('child content')).toBeDefined();
  });

  it('logs error to console.error', () => {
    render(
      <ErrorBoundary fallback={<div>fallback</div>}>
        <ThrowingChild shouldThrow />
      </ErrorBoundary>
    );
    expect(console.error).toHaveBeenCalledWith(
      '[ErrorBoundary]',
      expect.any(Error)
    );
  });

  it('auto-resets when resetKeys change', () => {
    function Wrapper() {
      const [key, setKey] = useState(0);
      const [shouldThrow, setShouldThrow] = useState(true);
      return (
        <div>
          <button onClick={() => { setShouldThrow(false); setKey((k) => k + 1); }}>
            navigate
          </button>
          <ErrorBoundary fallback={<div>crashed</div>} resetKeys={[key]}>
            <ThrowingChild shouldThrow={shouldThrow} />
          </ErrorBoundary>
        </div>
      );
    }

    render(<Wrapper />);
    expect(screen.getByText('crashed')).toBeDefined();
    fireEvent.click(screen.getByText('navigate'));
    expect(screen.getByText('child content')).toBeDefined();
  });
});
