export enum ResponseCode {
  // Success codes (0xxx)
  SUCCESS = 0,
  SIGNUP_SUCCESS = 1,
  SIGNIN_SUCCESS = 2,
  SIGNOUT_SUCCESS = 3,
  EMAIL_VERIFIED = 4,
  PASSWORD_RESET_SENT = 5,
  PASSWORD_RESET_SUCCESS = 6,
  PROFILE_UPDATED = 7,
  ACCOUNT_DELETED = 8,
  EMAIL_VERIFICATION_SENT = 9,
  ORGANIZATION_CREATE_SUCCESS = 50,
  ORGANIZATION_FETCH_SUCCESS = 51,
  ORGANIZATION_UPDATE_SUCCESS = 52,
  ORGANIZATION_DELETE_SUCCESS = 53,
  ORGANIZATION_VERIFY_SUCCESS = 54,
  ORGANIZATION_BAN_SUCCESS = 55,
  ORGANIZATION_UNBAN_SUCCESS = 56,

  // JobListing success
  JOB_LISTING_CREATE_SUCCESS = 71,

  // Service errors (1xxx)
  SERVICE_UNAVAILABLE = 1001,
  DATABASE_ERROR = 1002,
  REDIS_ERROR = 1003,
  S3_ERROR = 1004,

  // Validation errors (2xxx)
  MISSING_FIELDS = 2001,
  INVALID_CREDENTIALS = 2002,
  PASSWORDS_DO_NOT_MATCH = 2003,
  INVALID_EMAIL_FORMAT = 2004,
  INVALID_PASSWORD_FORMAT = 2005,
  INVALID_REQUEST_DATA = 2101,
  INVALID_IMAGE_TYPE = 2102,
  INVALID_IMAGE_SIZE = 2103,

  // Conflict errors (3xxx)
  EXISTING_EMAIL = 3001,
  EXISTING_USERNAME = 3002,
  MISSING_PHOTO = 3003,
  ORGANIZATION_EXISTS = 3101,
  ORGANIZATION_NOT_FOUND = 3102,
  ORGANIZATION_ALREADY_VERIFIED = 3103,
  ORGANIZATION_ALREADY_BANNED = 3104,
  ORGANIZATION_NOT_BANNED = 3105,
  ORGANIZATION_FETCH_ERROR = 3106,

  // Auth errors (4xxx)
  INVALID_TOKEN = 4001,
  EXPIRED_TOKEN = 4002,
  USER_BANNED = 4003,
  USER_DISABLED = 4004,
  USER_NOT_FOUND = 4005,
  USER_NOT_VERIFIED = 4006,
  TOKEN_INVALIDATED = 4007,

  // Rate limiting (5xxx)
  TOO_MANY_REQUESTS = 5001,
  RATE_LIMIT_EXCEEDED = 5002,

  UNKNOWN_ERROR = 9999,
}

export const RESPONSE_MESSAGES: Record<ResponseCode, string> = {
  // Success codes
  [ResponseCode.SUCCESS]: 'Operation completed successfully',
  [ResponseCode.SIGNUP_SUCCESS]:
    'User signed up successfully. Please verify your email.',
  [ResponseCode.SIGNIN_SUCCESS]: 'Signed in successfully',
  [ResponseCode.SIGNOUT_SUCCESS]: 'Signed out successfully',
  [ResponseCode.EMAIL_VERIFIED]: 'Email has been verified successfully',
  [ResponseCode.PASSWORD_RESET_SENT]:
    'If the email exists, a reset link has been sent',
  [ResponseCode.PASSWORD_RESET_SUCCESS]: 'Password has been reset successfully',
  [ResponseCode.PROFILE_UPDATED]: 'Profile updated successfully',
  [ResponseCode.ACCOUNT_DELETED]: 'Account deleted successfully',
  [ResponseCode.EMAIL_VERIFICATION_SENT]:
    'Verification email sent successfully',
  [ResponseCode.ORGANIZATION_CREATE_SUCCESS]:
    'Organization created successfully',
  [ResponseCode.ORGANIZATION_FETCH_SUCCESS]:
    'Organzations fetched successfully',
  [ResponseCode.ORGANIZATION_UPDATE_SUCCESS]:
    'Organization updated successfully',
  [ResponseCode.ORGANIZATION_DELETE_SUCCESS]:
    'Organization deleted successfully',
  [ResponseCode.ORGANIZATION_VERIFY_SUCCESS]:
    'Organization verified successfully',
  [ResponseCode.ORGANIZATION_BAN_SUCCESS]: 'Organization banned successfully',
  [ResponseCode.ORGANIZATION_UNBAN_SUCCESS]:
    'Organization unbanned successfully',

  [ResponseCode.JOB_LISTING_CREATE_SUCCESS]: 'Job listing created successfully',

  // Service errors
  [ResponseCode.SERVICE_UNAVAILABLE]:
    'Service temporarily unavailable. Please try again later.',
  [ResponseCode.DATABASE_ERROR]:
    'Database connection error. Please try again later.',
  [ResponseCode.REDIS_ERROR]: 'Cache service error. Please try again later.',
  [ResponseCode.S3_ERROR]:
    'File storage service error. Please try again later.',

  // Validation errors
  [ResponseCode.MISSING_FIELDS]: 'Missing required fields',
  [ResponseCode.INVALID_CREDENTIALS]: 'Invalid credentials',
  [ResponseCode.PASSWORDS_DO_NOT_MATCH]: 'Passwords do not match',
  [ResponseCode.INVALID_EMAIL_FORMAT]: 'Invalid email format',
  [ResponseCode.INVALID_PASSWORD_FORMAT]:
    'Password must be at least 8 characters',
  [ResponseCode.ORGANIZATION_EXISTS]:
    'Organization with this name already exists',
  [ResponseCode.ORGANIZATION_NOT_FOUND]: 'Organization not found',
  [ResponseCode.ORGANIZATION_ALREADY_VERIFIED]:
    'Organization has already been verified',
  [ResponseCode.ORGANIZATION_ALREADY_BANNED]:
    'Organization has already been banned',
  [ResponseCode.ORGANIZATION_NOT_BANNED]: 'Organization is not banned',
  [ResponseCode.ORGANIZATION_FETCH_ERROR]: 'Failed to fetch organization',
  [ResponseCode.INVALID_REQUEST_DATA]: 'Missing or invalid request data',
  [ResponseCode.INVALID_IMAGE_TYPE]: 'Only image files (jpg, jpeg) are allowed',
  [ResponseCode.INVALID_IMAGE_SIZE]: 'File size must be less than 5MB',

  // Conflict errors
  [ResponseCode.EXISTING_EMAIL]: 'User with this email already exists',
  [ResponseCode.EXISTING_USERNAME]: 'Username is already taken',
  [ResponseCode.MISSING_PHOTO]: 'Profile image is required',

  // Auth errors
  [ResponseCode.INVALID_TOKEN]: 'Invalid or expired token',
  [ResponseCode.EXPIRED_TOKEN]: 'Token has expired',
  [ResponseCode.USER_BANNED]: 'User is banned',
  [ResponseCode.USER_DISABLED]: 'User is disabled',
  [ResponseCode.USER_NOT_VERIFIED]: 'User is not verified',
  [ResponseCode.TOKEN_INVALIDATED]: 'Token has been invalidated',
  [ResponseCode.USER_NOT_FOUND]: 'User not found',

  // Rate limiting
  [ResponseCode.TOO_MANY_REQUESTS]: 'Too many requests from this IP',
  [ResponseCode.RATE_LIMIT_EXCEEDED]:
    'Rate limit exceeded. Please try again later.',

  // Unknown
  [ResponseCode.UNKNOWN_ERROR]:
    'An unknown error occurred. Please try again later',
};

export interface ApiResponse<T = any> {
  status: string;
  code: ResponseCode;
  message: string;
  data?: T;
  field?: string;
  details?: any;
  count?: number;
}

// Success response helper
export interface SuccessResponse<T = any> {
  status: string;
  code: ResponseCode;
  message: string;
  data?: T;
  count?: number;
}

// Error response helper
export interface ErrorResponse {
  status: string;
  code: ResponseCode;
  message: string;
  field?: string;
  details?: any;
}

export class ResponseHelper {
  // Create success response
  static success<T = any>(
    code: ResponseCode,
    data?: T,
    customMessage?: string,
    count?: number,
  ): SuccessResponse<T> {
    return {
      status: 'success',
      code,
      message: customMessage || RESPONSE_MESSAGES[code],
      ...(data !== undefined && { data }),
      count,
    };
  }

  // Create error response
  static error(
    code: ResponseCode,
    field?: string,
    details?: any,
    customMessage?: string,
  ): ErrorResponse {
    return {
      status: 'error',
      code,
      message: customMessage || RESPONSE_MESSAGES[code],
      ...(field && { field }),
      ...(details && { details }),
    };
  }

  // Get message by code
  static getMessage(code: ResponseCode): string {
    return RESPONSE_MESSAGES[code] || 'An unexpected error occurred';
  }

  // Check if code is success
  static isSuccess(code: ResponseCode): boolean {
    return code >= 0 && code < 1000;
  }

  // Check if code is error
  static isError(code: ResponseCode): boolean {
    return code >= 1000;
  }
}
