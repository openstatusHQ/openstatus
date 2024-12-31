import type { RouteConfig } from "@hono/zod-openapi";
import { createErrorSchema } from "./utils";

export const openApiErrorResponses = {
  400: {
    description:
      "The server cannot or will not process the request due to something that is perceived to be a client error (e.g., malformed request syntax, invalid request message framing, or deceptive request routing).",
    content: {
      "application/json": {
        schema: createErrorSchema("BAD_REQUEST").openapi("ErrBadRequest"),
      },
    },
  },
  401: {
    description:
      "The client must authenticate itself to get the requested response.",
    content: {
      "application/json": {
        schema: createErrorSchema("UNAUTHORIZED").openapi("ErrUnauthorized"),
      },
    },
  },
  402: {
    description: "A higher pricing plan is required to access the resource.",
    content: {
      "application/json": {
        schema:
          createErrorSchema("PAYMENT_REQUIRED").openapi("ErrPaymentRequired"),
      },
    },
  },
  403: {
    description:
      "The client does not have the necessary permissions to access the resource.",
    content: {
      "application/json": {
        schema: createErrorSchema("FORBIDDEN").openapi("ErrForbidden"),
      },
    },
  },
  404: {
    description: "The server can't find the requested resource.",
    content: {
      "application/json": {
        schema: createErrorSchema("NOT_FOUND").openapi("ErrNotFound"),
      },
    },
  },
  409: {
    description:
      "The request could not be completed due to a conflict mainly due to unique constraints.",
    content: {
      "application/json": {
        schema: createErrorSchema("CONFLICT").openapi("ErrConflict"),
      },
    },
  },
  500: {
    description:
      "The server has encountered a situation it doesn't know how to handle.",
    content: {
      "application/json": {
        schema: createErrorSchema("INTERNAL_SERVER_ERROR").openapi(
          "ErrInternalServerError",
        ),
      },
    },
  },
} satisfies RouteConfig["responses"];
