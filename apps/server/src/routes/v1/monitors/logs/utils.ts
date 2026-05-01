import { OpenStatusApiError } from "@/libs/errors";

const REDACTED = "[redacted]";
const SENSITIVE_HEADER_NAMES = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "proxy-authorization",
  "x-api-key",
  "x-auth-token",
]);

function isSensitiveHeader(name: string) {
  const normalized = name.toLowerCase();
  return (
    SENSITIVE_HEADER_NAMES.has(normalized) ||
    normalized.includes("secret") ||
    normalized.includes("token")
  );
}

export function checkResponseLogsLimit(limits: { "response-logs": boolean }) {
  if (!limits["response-logs"]) {
    throw new OpenStatusApiError({
      code: "PAYMENT_REQUIRED",
      message: "Upgrade for response logs",
    });
  }
}

export function redactSensitiveHeaders(headers: Record<string, string> | null) {
  if (!headers) return headers;

  return Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [
      name,
      isSensitiveHeader(name) ? REDACTED : value,
    ]),
  );
}
