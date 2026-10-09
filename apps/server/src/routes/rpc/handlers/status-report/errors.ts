import { Code, type ConnectError } from "@connectrpc/connect";

import { ErrorReason, idRequiredError, rpcError } from "../../errors";

export {
  invalidDateFormatError,
  pageComponentNotFoundError,
} from "../../errors";

export function statusReportIdRequiredError(): ConnectError {
  return idRequiredError("Status report");
}

export function invalidStatusError(statusValue: number): ConnectError {
  return rpcError({
    code: Code.InvalidArgument,
    reason: ErrorReason.INVALID_STATUS,
    message: `Invalid status value: ${statusValue}. Expected INVESTIGATING, IDENTIFIED, MONITORING, or RESOLVED`,
    metadata: { status: String(statusValue) },
  });
}
