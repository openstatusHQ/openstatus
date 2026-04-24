export type ServiceErrorCode =
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "UNAUTHORIZED"
  | "CONFLICT"
  | "VALIDATION"
  | "LIMIT_EXCEEDED"
  | "PRECONDITION_FAILED"
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

/**
 * Precondition not met — the operation is semantically disallowed in
 * the current state of the system (e.g. account deletion blocked by an
 * active paid subscription). Distinct from `FORBIDDEN` (authorization)
 * and `CONFLICT` (concurrent-write race). Maps to tRPC
 * `PRECONDITION_FAILED`.
 */
export class PreconditionFailedError extends ServiceError {
  constructor(message: string) {
    super("PRECONDITION_FAILED", message);
  }
}

export class InternalServiceError extends ServiceError {
  constructor(message: string, cause?: unknown) {
    super("INTERNAL", message, cause);
  }
}
