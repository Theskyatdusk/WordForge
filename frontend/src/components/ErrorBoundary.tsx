/**
 * ErrorBoundary — Class-based error boundary that catches render errors
 * and shows a friendly fallback message with a "返回首页" button.
 */
import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
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

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4 text-center">
          <div className="text-5xl">:(</div>
          <p className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
            页面出错了
          </p>
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
            抱歉，页面发生了未知错误，请尝试返回首页重新操作。
          </p>
          <button
            onClick={this.handleGoHome}
            className="mt-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer"
            style={{
              background: 'var(--teal-600)',
              color: '#fff',
            }}
          >
            返回首页
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
