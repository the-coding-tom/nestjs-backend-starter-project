import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../common/enums/generic.enum';
import {
  RequestResponse,
  CaughtError,
  AppError,
  ExternalApiError,
  ServiceErrorResponse,
} from '../common/types/response.types';

/**
 * Type guard to check if error has external API response structure
 */
function isExternalApiError(error: unknown): error is ExternalApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as ExternalApiError).response === 'object'
  );
}

/**
 * Type guard to check if error is an AppError with code property
 */
function isAppError(error: unknown): error is AppError {
  return (
    error instanceof Error &&
    'code' in error &&
    typeof (error as AppError).code === 'number'
  );
}

/**
 * Generate a standardized success response
 */
export function generateSuccessResponse(response: RequestResponse) {
  if (!response.data) {
    return {
      status: response.statusCode,
      message: response.message,
    };
  }

  return {
    status: response.statusCode,
    message: response.message,
    data: response.data,
    ...(response?.meta && { meta: response.meta }),
  };
}

/**
 * Generate a standardized error response
 */
export function generateErrorResponse(error: unknown): ServiceErrorResponse {
  // Handle external API errors (e.g., Axios errors)
  if (isExternalApiError(error) && error.response?.status === HttpStatus.BAD_REQUEST) {
    return {
      status: error.response.status,
      errorCode: ErrorCode.SERVER_ERROR,
      message:
        error.response.data.message ||
        error.response.data.error ||
        error.response.data.error_description ||
        'Bad request',
    };
  }

  // Handle app errors thrown by validators/services
  if (isAppError(error)) {
    return {
      status: error.code ?? HttpStatus.INTERNAL_SERVER_ERROR,
      errorCode: error.errorCode ?? ErrorCode.SERVER_ERROR,
      message: error.message || 'An error occurred',
    };
  }

  // Handle CaughtError interface (legacy support)
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as CaughtError).code === 'number'
  ) {
    const caughtError = error as CaughtError;
    return {
      status: caughtError.code ?? HttpStatus.INTERNAL_SERVER_ERROR,
      errorCode: caughtError.errorCode ?? ErrorCode.SERVER_ERROR,
      message: caughtError.message || 'An error occurred',
    };
  }

  // Default for unknown errors
  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    errorCode: ErrorCode.SERVER_ERROR,
    message: 'Internal server error',
  };
}

/**
 * Throw a standardized error with code and errorCode
 */
export function throwError(
  message: string,
  code: number | null = null,
  errorCode: string | null = null,
): never {
  const error = new Error(message) as AppError;
  error.code = code ?? undefined;
  error.errorCode = errorCode ?? undefined;

  throw error;
}
