"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";

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

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
          <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Algo salió mal</h2>
          <p className="text-sm text-muted-foreground mb-4 max-w-md">
            Ocurrió un error inesperado. Intenta recargar la página o contacta al administrador si el problema persiste.
          </p>
          {this.state.error && (
            <pre className="text-xs text-muted-foreground bg-muted p-3 rounded-md mb-4 max-w-md overflow-auto">
              {this.state.error.message}
            </pre>
          )}
          <Button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Recargar página
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
