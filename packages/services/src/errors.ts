export type ServiceErrorCode =
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "UNAUTHORIZED"
  | "CONFLICT"
  | "VALIDATION"
  | "LIMIT_EXCEEDED"
  | "INTERNAL";

export class ServiceError extends Error {
  constructor(
    public code: ServiceErrorCode,
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class NotFoundError extends ServiceError {
  constructor(entity: string, id: string | number) {
    super("NOT_FOUND", `${entity} ${id} not found`);
  }
}

export class ForbiddenError extends ServiceError {
  constructor(message: string) {
    super("FORBIDDEN", message);
  }
}

export class UnauthorizedError extends ServiceError {
  constructor(message: string) {
    super("UNAUTHORIZED", message);
  }
}

export class ConflictError extends ServiceError {
  constructor(message: string) {
    super("CONFLICT", message);
  }
}

export class ValidationError extends ServiceError {
  constructor(message: string, cause?: unknown) {
    super("VALIDATION", message, cause);
  }
}

export class LimitExceededError extends ServiceError {
  constructor(limit: string, max: number) {
    super("LIMIT_EXCEEDED", `${limit} limit reached (${max})`);
  }
}

export class InternalServiceError extends ServiceError {
  constructor(message: string, cause?: unknown) {
    super("INTERNAL", message, cause);
  }
}
