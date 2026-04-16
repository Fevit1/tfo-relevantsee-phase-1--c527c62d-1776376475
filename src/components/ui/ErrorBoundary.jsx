'use client';

import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    // Log to console in all environments for debugging
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    const { hasError, error, errorInfo } = this.state;
    const { fallback, children } = this.props;

    if (!hasError) {
      return children;
    }

    // Allow custom fallback component
    if (fallback) {
      if (typeof fallback === 'function') {
        return fallback({ error, errorInfo, reset: this.handleReset });
      }
      return fallback;
    }

    const isDev = process.env.NODE_ENV === 'development';

    return (
      <div className="min-h-[200px] flex items-center justify-center p-6">
        <div className="w-full max-w-lg bg-gray-900 border border-red-500/30 rounded-xl p-6 shadow-lg">
          {/* Icon + Heading */}
          <div className="flex items-start gap-4 mb-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-semibold text-white mb-1">
                Something went wrong
              </h2>
              <p className="text-sm text-gray-400">
                An unexpected error occurred while rendering this section. You
                can try again or refresh the page.
              </p>
            </div>
          </div>

          {/* Error details in development */}
          {isDev && error && (
            <div className="mb-4 rounded-lg bg-gray-950 border border-gray-700 overflow-hidden">
              <div className="px-3 py-2 bg-gray-800 border-b border-gray-700">
                <span className="text-xs font-mono text-red-400 font-semibold uppercase tracking-wide">
                  Error Details (dev only)
                </span>
              </div>
              <div className="p-3 overflow-x-auto">
                <p className="text-xs font-mono text-red-300 break-all whitespace-pre-wrap mb-2">
                  {error.toString()}
                </p>
                {errorInfo?.componentStack && (
                  <details className="mt-2">
                    <summary className="text-xs font-mono text-gray-500 cursor-pointer hover:text-gray-400 select-none">
                      Component stack
                    </summary>
                    <pre className="mt-2 text-xs font-mono text-gray-400 whitespace-pre-wrap overflow-x-auto max-h-48 overflow-y-auto">
                      {errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                />
              </svg>
              Try again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 active:bg-gray-800 text-gray-200 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-900"
            >
              Reload page
            </button>
          </div>
        </div>
      </div>
    );
  }
}

/**
 * Higher-order component that wraps a component in an ErrorBoundary.
 *
 * Usage:
 *   const SafeComponent = withErrorBoundary(MyComponent);
 *   const SafeComponent = withErrorBoundary(MyComponent, { fallback: <CustomFallback /> });
 */
export function withErrorBoundary(WrappedComponent, options = {}) {
  const { fallback, displayName } = options;

  const WithErrorBoundaryWrapper = (props) => (
    <ErrorBoundary fallback={fallback}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  WithErrorBoundaryWrapper.displayName =
    displayName ||
    `withErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;

  return WithErrorBoundaryWrapper;
}

export default ErrorBoundary;

// Auto-added named-export aliases (deploy reconciler)
export { default as ErrorBoundary };
