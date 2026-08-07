import { ServiceError, type ServiceContext } from "@openstatus/services";

import { tb } from "@/libs/clients";
import { OpenStatusApiError } from "@/libs/errors";

import type { Variables } from "../index";

export function toServiceContext(c: {
  get<K extends keyof Variables>(key: K): Variables[K];
}): ServiceContext {
  const apiKey = c.get("apiKey");
  return {
    workspace: c.get("workspace"),
    actor: {
      type: "apiKey",
      keyId: apiKey.id,
      userId: apiKey.createdById,
      scopes: apiKey.scopes,
    },
    requestId: c.get("requestId"),
    tb,
  };
}

export function throwApiError(error: unknown): never {
  if (error instanceof ServiceError) {
    const code =
      error.code === "NOT_FOUND"
        ? "NOT_FOUND"
        : error.code === "FORBIDDEN"
          ? "FORBIDDEN"
          : error.code === "UNAUTHORIZED"
            ? "UNAUTHORIZED"
            : error.code === "CONFLICT" ||
                error.code === "VALIDATION" ||
                error.code === "PRECONDITION_FAILED"
              ? "BAD_REQUEST"
              : error.code === "LIMIT_EXCEEDED"
                ? "CONFLICT"
                : "INTERNAL_SERVER_ERROR";
    throw new OpenStatusApiError({ code, message: error.message });
  }
  throw error;
}
