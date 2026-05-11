import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Home, RefreshCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  componentName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[ErrorBoundary] Error in component "${this.props.componentName || 'Unknown'}":`, error, errorInfo);
  }

  private handleGoHome = () => {
    window.location.href = '/';
  };

  private handleRefresh = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[400px] flex flex-col items-center justify-center p-8 text-center glass rounded-[48px] m-4 animate-in fade-in zoom-in duration-300">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
            <RefreshCcw className="w-10 h-10 text-red-500 animate-spin-slow" />
          </div>
          <h2 className="text-2xl font-bold text-text-primary mb-2">Something went wrong</h2>
          <p className="text-text-muted mb-8 max-w-md">
            The component "{this.props.componentName || 'this section'}" encountered an error. Please refresh or go back Home.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <button
              onClick={this.handleRefresh}
              className="px-6 py-3 bg-red-500 text-white rounded-full font-bold flex items-center gap-2 hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
            >
              <RefreshCcw className="w-5 h-5" />
              Refresh App
            </button>
            <button
              onClick={this.handleGoHome}
              className="px-6 py-3 bg-white text-text-primary border border-gray-100 rounded-full font-bold flex items-center gap-2 hover:bg-gray-50 transition-colors shadow-lg shadow-black/5"
            >
              <Home className="w-5 h-5" />
              Go Home
            </button>
          </div>
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-8 p-4 bg-gray-900 text-red-400 rounded-2xl text-left text-xs font-mono overflow-auto max-w-full">
              {this.state.error?.toString()}
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
