export interface RequestResponse {
  statusCode: number;
  message: string;
  data?: unknown;
  meta?: Record<string, unknown>;
}

export interface CaughtError {
  code?: number;
  errorCode?: string;
  message: string;
}

/**
 * Extended error interface for errors thrown by validators/services
 * with HTTP status code and error code
 */
export interface AppError extends Error {
  code?: number;
  errorCode?: string;
}

/**
 * Axios-style error response for external API errors
 */
export interface ExternalApiError {
  response?: {
    status: number;
    data: {
      message?: string;
      error?: string;
      error_description?: string;
    };
  };
}

/**
 * Service error response format
 */
export interface ServiceErrorResponse {
  status: number;
  errorCode: string;
  message: string;
}
