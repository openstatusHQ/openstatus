import { createErrorSchema } from "./utils";

export const openApiErrorResponses = {
  400: {
    description:
      "The server cannot or will not process the request due to something that is perceived to be a client error (e.g., malformed request syntax, invalid request message framing, or deceptive request routing).",
    content: {
      "application/json": {
        schema: createErrorSchema("BAD_REQUEST"),
      },
    },
  },
  401: {
    description:
      "The client must authenticate itself to get the requested response.",
    content: {
      "application/json": {
        schema: createErrorSchema("UNAUTHORIZED"),
      },
    },
  },
  403: {
    description:
      "The client does not have the necessary permissions to access the resource.",
    content: {
      "application/json": {
        schema: createErrorSchema("FORBIDDEN"),
      },
    },
  },
  404: {
    description: "The server can't find the requested resource.",
    content: {
      "application/json": {
        schema: createErrorSchema("NOT_FOUND"),
      },
    },
  },
};
