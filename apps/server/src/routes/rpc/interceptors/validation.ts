import { createValidateInterceptor } from "@connectrpc/validate";

/**
 * Validation interceptor for ConnectRPC using protovalidate.
 * Validates incoming request messages against their proto constraints.
 *
 * Uses @connectrpc/validate which provides a proper interceptor that:
 * - Validates request messages using protovalidate rules
 * - Returns InvalidArgument error for validation failures
 * - Works with all message types defined with buf.validate constraints
 */
export const validationInterceptor = createValidateInterceptor;
