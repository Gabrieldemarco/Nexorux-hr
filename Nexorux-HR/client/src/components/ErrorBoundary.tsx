import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { logError } from '../utils/errorHandler';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      errorInfo
    });
    
    logError(error, errorInfo);
    
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div 
          className="min-h-screen grid items-center justify-center p-6"
          style={{ background: 'var(--bg-app)' }}
          role="alert"
          aria-live="assertive"
        >
          <div className="card" style={{ maxWidth: '500px', textAlign: 'center' }}>
            <div 
              className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
              style={{ 
                background: 'rgba(244, 63, 94, 0.15)',
                color: '#FB7185'
              }}
            >
              <AlertTriangle size={32} />
            </div>
            
            <h1 
              className="text-2xl font-extrabold mb-2"
              style={{ color: 'var(--text-primary)' }}
            >
              Algo salió mal
            </h1>
            
            <p 
              className="text-sm mb-6"
              style={{ color: 'var(--text-secondary)' }}
            >
              Ha ocurrido un error inesperado. Nuestro equipo ha sido notificado y está trabajando en solucionarlo.
            </p>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details 
                className="text-left mb-6 p-4 rounded-lg overflow-auto"
                style={{ 
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  maxHeight: '200px'
                }}
              >
                <summary className="text-xs font-semibold cursor-pointer mb-2" style={{ color: 'var(--text-muted)' }}>
                  Detalles técnicos (desarrollo)
                </summary>
                <pre className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="btn-primary"
              >
                <RefreshCw size={16} />
                Intentar nuevamente
              </button>
              <button
                onClick={this.handleGoHome}
                className="btn-secondary"
              >
                <Home size={16} />
                Ir al inicio
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Simpler error message component for inline errors
interface ErrorMessageProps {
  message: string;
  onDismiss?: () => void;
  type?: 'error' | 'warning' | 'info';
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  message,
  onDismiss,
  type = 'error'
}) => {
  const typeStyles = {
    error: 'alert-error',
    warning: 'alert-warning',
    info: 'alert-info'
  };

  return (
    <div 
      className={`alert-box ${typeStyles[type]} text-xs flex items-center justify-between`}
      role="alert"
    >
      <div className="flex items-center gap-2">
        {type === 'error' && <AlertTriangle size={14} aria-hidden="true" />}
        <span>{message}</span>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="ml-2 hover:opacity-70 transition-opacity"
          aria-label="Cerrar mensaje"
        >
          ✕
        </button>
      )}
    </div>
  );
};

// Toast notification for errors
interface ErrorToastProps {
  message: string;
  onClose: () => void;
  duration?: number;
}

export const ErrorToast: React.FC<ErrorToastProps> = ({
  message,
  onClose,
  duration = 5000
}) => {
  React.useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div
      className="fixed top-4 right-4 z-50 animate-fade-in"
      role="alert"
      aria-live="polite"
    >
      <div 
        className="glass-modal rounded-lg p-4 shadow-lg flex items-center gap-3"
        style={{ maxWidth: '400px' }}
      >
        <div 
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(244, 63, 94, 0.15)', color: '#FB7185' }}
        >
          <AlertTriangle size={16} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Error
          </p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {message}
          </p>
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 hover:opacity-70 transition-opacity"
          aria-label="Cerrar notificación"
        >
          ✕
        </button>
      </div>
    </div>
  );
};