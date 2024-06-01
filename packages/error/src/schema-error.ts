import type { ZodError } from "zod";

import { BaseError } from "./base-error";
import type { ErrorCode } from "./error-code";
import { parseZodErrorIssues } from "./utils";

type Context = { raw: unknown };

export class SchemaError extends BaseError<Context> {
  public readonly name = SchemaError.name;
  public readonly code: ErrorCode;

  constructor(opts: {
    code: ErrorCode;
    message: string;
    cause?: BaseError;
    context?: Context;
  }) {
    super(opts);
    this.code = opts.code;
  }

  static fromZod<T>(e: ZodError<T>, raw: unknown): SchemaError {
    return new SchemaError({
      code: "UNPROCESSABLE_ENTITY",
      message: parseZodErrorIssues(e.issues),
      context: { raw: JSON.stringify(raw) },
    });
  }
}
