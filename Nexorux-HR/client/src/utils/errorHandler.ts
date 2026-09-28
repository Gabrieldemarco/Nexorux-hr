// Centralized error handling utilities

export interface AppError {
  message: string;
  code?: string;
  statusCode?: number;
  details?: any;
  userMessage?: string;
  isNetworkError?: boolean;
  isValidationError?: boolean;
  isAuthError?: boolean;
}

export class ErrorClassifier {
  static classify(error: any): AppError {
    // Network errors
    if (!navigator.onLine) {
      return {
        message: 'No hay conexión a internet',
        userMessage: 'Por favor verifica tu conexión a internet e intenta nuevamente',
        isNetworkError: true
      };
    }

    // API response errors
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;

      switch (status) {
        case 400:
          return {
            message: data?.message || 'Solicitud inválida',
            userMessage: 'Por favor verifica los datos ingresados e intenta nuevamente',
            statusCode: status,
            isValidationError: true,
            details: data
          };
        case 401:
          return {
            message: 'No autorizado',
            userMessage: 'Tu sesión ha expirado. Por favor inicia sesión nuevamente',
            statusCode: status,
            isAuthError: true
          };
        case 403:
          return {
            message: 'Acceso denegado',
            userMessage: 'No tienes permisos para realizar esta acción',
            statusCode: status,
            isAuthError: true
          };
        case 404:
          return {
            message: 'Recurso no encontrado',
            userMessage: 'El recurso solicitado no existe o ha sido eliminado',
            statusCode: status
          };
        case 409:
          return {
            message: 'Conflicto de datos',
            userMessage: data?.message || 'Esta acción crea un conflicto con datos existentes',
            statusCode: status,
            details: data
          };
        case 422:
          return {
            message: 'Error de validación',
            userMessage: 'Por favor corrige los errores en el formulario',
            statusCode: status,
            isValidationError: true,
            details: data
          };
        case 429:
          return {
            message: 'Demasiadas solicitudes',
            userMessage: 'Por favor espera unos minutos antes de intentar nuevamente',
            statusCode: status
          };
        case 500:
          return {
            message: 'Error del servidor',
            userMessage: 'Ha ocurrido un error en el servidor. Por favor intenta más tarde',
            statusCode: status
          };
        case 503:
          return {
            message: 'Servicio no disponible',
            userMessage: 'El servicio está temporalmente no disponible. Por favor intenta más tarde',
            statusCode: status
          };
        default:
          return {
            message: data?.message || `Error ${status}`,
            userMessage: 'Ha ocurrido un error inesperado',
            statusCode: status,
            details: data
          };
      }
    }

    // Request errors (no response)
    if (error.request) {
      return {
        message: 'Error de conexión',
        userMessage: 'No se pudo conectar con el servidor. Por favor verifica tu conexión',
        isNetworkError: true
      };
    }

    // Generic errors
    if (error.message) {
      return {
        message: error.message,
        userMessage: this.getUserFriendlyMessage(error.message)
      };
    }

    // Unknown errors
    return {
      message: 'Error desconocido',
      userMessage: 'Ha ocurrido un error inesperado. Por favor intenta nuevamente'
    };
  }

  private static getUserFriendlyMessage(technicalMessage: string): string {
    const message = technicalMessage.toLowerCase();
    
    if (message.includes('network') || message.includes('fetch')) {
      return 'Error de conexión. Por favor verifica tu internet';
    }
    if (message.includes('timeout')) {
      return 'La solicitud tardó demasiado tiempo. Por favor intenta nuevamente';
    }
    if (message.includes('parse') || message.includes('json')) {
      return 'Error al procesar la respuesta del servidor';
    }
    if (message.includes('permission') || message.includes('access')) {
      return 'No tienes permisos para realizar esta acción';
    }
    if (message.includes('not found')) {
      return 'El recurso solicitado no fue encontrado';
    }
    
    return technicalMessage;
  }
}

export const handleApiError = (error: any): AppError => {
  return ErrorClassifier.classify(error);
};

export const getErrorMessage = (error: any, fallbackMessage = 'Ha ocurrido un error'): string => {
  const classified = handleApiError(error);
  return classified.userMessage || classified.message || fallbackMessage;
};

// Error boundary component utilities
export const logError = (error: Error, errorInfo?: any) => {
  console.error('Application Error:', error);
  if (errorInfo) {
    console.error('Error Info:', errorInfo);
  }
  
  // Here you could send to error tracking service like Sentry
  // Sentry.captureException(error, { extra: errorInfo });
};

export const isAuthError = (error: any): boolean => {
  const classified = handleApiError(error);
  return classified.isAuthError || false;
};

export const isNetworkError = (error: any): boolean => {
  const classified = handleApiError(error);
  return classified.isNetworkError || false;
};

export const isValidationError = (error: any): boolean => {
  const classified = handleApiError(error);
  return classified.isValidationError || false;
};

// Retry logic for network errors
export const shouldRetry = (error: any, attempt: number, maxAttempts = 3): boolean => {
  if (attempt >= maxAttempts) return false;
  
  const classified = handleApiError(error);
  
  // Retry on network errors or 5xx server errors
  return classified.isNetworkError || 
         (classified.statusCode && classified.statusCode >= 500);
};

export const withRetry = async <T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  delay = 1000
): Promise<T> => {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (!shouldRetry(error, attempt, maxAttempts)) {
        throw error;
      }
      
      // Exponential backoff
      const waitTime = delay * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  throw lastError;
};