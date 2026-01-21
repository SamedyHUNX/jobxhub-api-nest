import { InternalServerErrorException, HttpException } from '@nestjs/common';
import { ResponseCode, ResponseHelper } from './response-helper';

export function catchAsync<T>(
  fn: (...args: any[]) => Promise<T>,
  logger: { error: (msg: string) => void },
  errorMessage = 'Failed to process request',
) {
  return async (...args: any[]): Promise<T> => {
    try {
      return await fn(...args);
    } catch (error: any) {
      // Pass through Nest HTTP exceptions that already have ResponseHelper structure
      // We check for instanceof HttpException OR if it looks like one (has getStatus/getResponse methods)
      // This handles potential package version mismatches where instanceof might fail
      if (
        error instanceof HttpException ||
        (typeof error?.getStatus === 'function' &&
          typeof error?.getResponse === 'function')
      ) {
        throw error;
      }

      // Log details about the unexpected error to help debugging
      if (process.env.NODE_ENV !== 'production') {
        const errorDetails = {
          name: error?.name,
          constructor: error?.constructor?.name,
          message: error?.message,
          stack: error?.stack,
        };
        logger.error(
          `[catchAsync] Unexpected error caught: ${JSON.stringify(errorDetails)}`,
        );
      }

      // Log unexpected errors and return a standardized error response
      logger.error(`${errorMessage}: ${error?.message ?? 'Unknown error'}`);
      const isProd = process.env.NODE_ENV === 'production';
      throw new InternalServerErrorException(
        ResponseHelper.error(
          ResponseCode.SERVICE_UNAVAILABLE,
          undefined,
          isProd ? undefined : { message: error?.message, stack: error?.stack },
          errorMessage,
        ),
      );
    }
  };
}
