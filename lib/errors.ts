/**
 * Base application error class
 */
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational: boolean = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * Validation error (400)
 */
export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, message);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Authentication error (401)
 */
export class AuthenticationError extends AppError {
  constructor(message: string = "Authentication required") {
    super(401, message);
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/**
 * Authorization error (403)
 */
export class AuthorizationError extends AppError {
  constructor(message: string = "Insufficient permissions") {
    super(403, message);
    Object.setPrototypeOf(this, AuthorizationError.prototype);
  }
}

/**
 * Not found error (404)
 */
export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(404, `${resource} not found`);
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * External API error (502)
 */
export class ExternalAPIError extends AppError {
  constructor(service: string, originalError: Error) {
    super(502, `${service} API error: ${originalError.message}`);
    Object.setPrototypeOf(this, ExternalAPIError.prototype);
  }
}

/**
 * Storage error (500)
 */
export class StorageError extends AppError {
  constructor(operation: string, originalError: Error) {
    super(500, `Storage ${operation} failed: ${originalError.message}`);
    Object.setPrototypeOf(this, StorageError.prototype);
  }
}

/**
 * Database error (500)
 */
export class DatabaseError extends AppError {
  constructor(operation: string, originalError: Error) {
    super(500, `Database ${operation} failed: ${originalError.message}`);
    Object.setPrototypeOf(this, DatabaseError.prototype);
  }
}
