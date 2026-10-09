import { ConnectError, type Interceptor } from "@connectrpc/connect";
import { createValidateInterceptor } from "@connectrpc/validate";

import { ErrorReason, rpcError } from "@/libs/errors/rpc";

// Methods that skip standard protovalidate (they do manual validation in handlers)
// These methods use partial updates where nested message fields are optional
const SKIP_VALIDATION_METHODS = new Set([
  "UpdateHTTPMonitor",
  "UpdateTCPMonitor",
  "UpdateDNSMonitor",
  "UpdateICMPMonitor",
  "UpdateGRPCMonitor",
]);

// protovalidate >=1.2 dropped the "value " prefix from the string.pattern
// violation message; restore it so API consumers (and existing tests) keep
// the previous wording.
function normalizeValidationMessage(message: string): string {
  return message.replace(
    /(^|: )does not match regex pattern/g,
    "$1value does not match regex pattern",
  );
}

const VIOLATIONS_TYPE = "buf.validate.Violations";

function isProtovalidateError(err: ConnectError): boolean {
  return err.details.some((d) =>
    "desc" in d
      ? d.desc.typeName === VIOLATIONS_TYPE
      : d.type === VIOLATIONS_TYPE,
  );
}

/**
 * Validation interceptor for ConnectRPC using protovalidate.
 * Validates incoming request messages against their proto constraints.
 *
 * Uses @connectrpc/validate which provides a proper interceptor that:
 * - Validates request messages using protovalidate rules
 * - Returns InvalidArgument error for validation failures
 * - Works with all message types defined with buf.validate constraints
 *
 * Note: Update methods skip validation because they support partial updates
 * where nested message fields are optional. Validation for these methods
 * is done in the service handlers.
 */
export function validationInterceptor(): Interceptor {
  const baseInterceptor = createValidateInterceptor();
  return (next) => async (req) => {
    // Skip validation for update methods that support partial updates
    if (SKIP_VALIDATION_METHODS.has(req.method.name)) {
      return next(req);
    }
    try {
      return await baseInterceptor(next)(req);
    } catch (err) {
      // Handler errors also pass through here; only protovalidate's own
      // rejection (recognisable by its Violations detail) gets rebuilt.
      if (err instanceof ConnectError && isProtovalidateError(err)) {
        const rebuilt = rpcError({
          code: err.code,
          reason: ErrorReason.VALIDATION_FAILED,
          message: normalizeValidationMessage(err.rawMessage),
          cause: err.cause,
        });
        err.metadata.forEach((value, key) => rebuilt.metadata.set(key, value));
        rebuilt.details.push(...err.details);
        throw rebuilt;
      }
      throw err;
    }
  };
}
