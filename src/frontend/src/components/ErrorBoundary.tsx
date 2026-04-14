import React, { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // In production this would go to Sentry / Datadog
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="max-w-md w-full rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center space-y-4">
            <h2 className="text-xl font-semibold text-destructive">Något gick fel</h2>
            <p className="text-sm text-muted-foreground">
              {this.state.error?.message ?? 'Ett oväntat fel inträffade.'}
            </p>
            <button
              onClick={this.handleReset}
              className="mt-2 px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Försök igen
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
