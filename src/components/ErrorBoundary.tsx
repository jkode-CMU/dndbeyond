import React from 'react';

type Props = { children: React.ReactNode };
type State = { hasError: boolean; error?: Error };

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: any) {
    // Log error to console for debugging
    // In the future this could send errors to a telemetry endpoint
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-3 bg-red-50 dark:bg-red-900 rounded border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-200">
          <div className="font-medium">An error occurred while rendering this section.</div>
          <div className="mt-1">Check the developer console for details.</div>
        </div>
      );
    }
    return this.props.children as React.ReactElement;
  }
}
