import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";

import {
  type ErrorCode,
  ErrorCodeEnum,
  SchemaError,
  statusToCode,
} from "@openstatus/error";

import { ZodError, z } from "zod";

export function handleError(err: Error, c: Context): Response {
  if (err instanceof ZodError) {
    const error = SchemaError.fromZod(err, c);
    return c.json<ErrorSchema>(
      {
        code: "BAD_REQUEST",
        message: error.message,
        docs: "https://docs.openstatus.dev/api-references/errors/code/BAD_REQUEST",
        requestId: c.get("requestId"),
      },
      { status: 400 },
    );
  }
  if (err instanceof HTTPException) {
    const code = statusToCode(err.status);
    return c.json<ErrorSchema>(
      {
        code: code,
        message: err.message,
        docs: `https://docs.openstatus.dev/api-references/errors/code/${code}`,
        requestId: c.get("requestId"),
      },
      { status: err.status },
    );
  }
  return c.json<ErrorSchema>(
    {
      code: "INTERNAL_SERVER_ERROR",
      message: err.message ?? "Something went wrong",
      docs: "https://docs.openstatus.dev/api-references/errors/code/INTERNAL_SERVER_ERROR",
      requestId: c.get("requestId"),
    },

    { status: 500 },
  );
}

export function handleZodError(
  result:
    | {
        success: true;
        data: unknown;
      }
    | {
        success: false;
        error: ZodError;
      },
  c: Context,
) {
  if (!result.success) {
    const error = SchemaError.fromZod(result.error, c);
    return c.json<z.infer<ReturnType<typeof createErrorSchema>>>(
      {
        code: "BAD_REQUEST",
        docs: "https://docs.openstatus.dev/api-references/errors/code/BAD_REQUEST",
        message: error.message,
        requestId: c.get("requestId"),
      },
      { status: 400 },
    );
  }
}

export function createErrorSchema(code: ErrorCode) {
  return z.object({
    code: ErrorCodeEnum.openapi({
      example: code,
      description: "The error code related to the status code.",
    }),
    message: z.string().openapi({
      description: "A human readable message describing the issue.",
      example: "Missing required field 'name'.",
    }),
    docs: z.string().openapi({
      description: "A link to the documentation for the error.",
      example: `https://docs.openstatus.dev/api-references/errors/code/${code}`,
    }),
    requestId: z.string().openapi({
      description: "The request id to be used for debugging.",
      example: "random-uuid",
    }),
  });
}

export type ErrorSchema = z.infer<ReturnType<typeof createErrorSchema>>;
