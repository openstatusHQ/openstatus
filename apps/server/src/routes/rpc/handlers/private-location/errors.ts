import { Code, type ConnectError } from "@connectrpc/connect";

import { ErrorReason, idRequiredError, rpcError } from "../../errors";

export function privateLocationNotFoundError(
  privateLocationId: string,
): ConnectError {
  return rpcError({
    code: Code.NotFound,
    reason: ErrorReason.PRIVATE_LOCATION_NOT_FOUND,
    message: "Private location not found",
    metadata: { privateLocationId },
  });
}

export function privateLocationIdRequiredError(): ConnectError {
  return idRequiredError("Private location");
}

export function invalidMonitorIdError(monitorId: string): ConnectError {
  return rpcError({
    code: Code.InvalidArgument,
    reason: ErrorReason.INVALID_MONITOR_ID,
    message: `Invalid monitor id: "${monitorId}"`,
    metadata: { monitorId },
  });
}
