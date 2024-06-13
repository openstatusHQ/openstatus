import type { ErrorCode } from "./error-code";

type ErrorContext = Record<string, unknown>;

export abstract class BaseError<
  TContext extends ErrorContext = ErrorContext,
> extends Error {
  public abstract readonly name: string;
  /**
   * A distinct code for the error type used to differentiate between different types of errors.
   * Used to build the URL for the error documentation.
   * @example 'UNAUTHENTICATED' | 'INTERNAL_SERVER_ERROR'
   */
  public abstract readonly code?: ErrorCode;
  public readonly cause?: BaseError;
  /**
   * Additional context to help understand the error.
   * @example { url: 'https://example.com/api', method: 'GET', statusCode: 401 }
   */
  public readonly context?: TContext;

  constructor(opts: {
    message: string;
    cause?: BaseError;
    context?: TContext;
  }) {
    super(opts.message);
    this.cause = opts.cause;
    this.context = opts.context;

    // TODO: add logger here!
  }

  public toString(): string {
    return `${this.name}(${this.code}): ${
      this.message
    } - caused by ${this.cause?.toString()} - with context ${JSON.stringify(
      this.context,
    )}`;
  }

  // get docs(): string {
  //   if (!this.code) return "https://example.com/docs/errors"
  //   return `https://example.com/docs/errors/${this.code}`;
  // }
}
