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
  429: {
    description:
      "The rate limit for the API key, token or client IP was exceeded. Retry after the number of seconds in the `Retry-After` header. See https://www.openstatus.dev/docs/reference/api-rate-limits.",
    headers: {
      "Retry-After": {
        description: "Seconds to wait before retrying.",
        schema: { type: "integer", example: 7 },
      },
    },
    content: {
      "application/json": {
        schema:
          createErrorSchema("TOO_MANY_REQUESTS").openapi("ErrTooManyRequests"),
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
  503: {
    description:
      "The server is shedding load. Retry after the number of seconds in the `Retry-After` header.",
    headers: {
      "Retry-After": {
        description: "Seconds to wait before retrying.",
        schema: { type: "integer", example: 5 },
      },
    },
    content: {
      "application/json": {
        schema: createErrorSchema("SERVICE_UNAVAILABLE").openapi(
          "ErrServiceUnavailable",
        ),
      },
    },
  },
} satisfies RouteConfig["responses"];
