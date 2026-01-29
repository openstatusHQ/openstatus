import type { Interceptor } from "@connectrpc/connect";
import { createValidateInterceptor } from "@connectrpc/validate";

// Methods that skip standard protovalidate (they do manual validation in handlers)
// These methods use partial updates where nested message fields are optional
const SKIP_VALIDATION_METHODS = new Set([
  "UpdateHTTPMonitor",
  "UpdateTCPMonitor",
  "UpdateDNSMonitor",
]);

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
    return baseInterceptor(next)(req);
  };
}
