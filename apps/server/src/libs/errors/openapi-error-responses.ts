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
};
