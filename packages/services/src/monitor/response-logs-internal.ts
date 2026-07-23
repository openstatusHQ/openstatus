const REDACTED = "[redacted]";

const SENSITIVE_HEADER_NAMES = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "proxy-authorization",
  "x-api-key",
  "x-auth-token",
]);

const SENSITIVE_HEADER_PARTS = [
  "auth",
  "cookie",
  "credential",
  "key",
  "secret",
  "session",
  "token",
];

function isSensitiveHeader(name: string) {
  const normalized = name.toLowerCase();
  return (
    SENSITIVE_HEADER_NAMES.has(normalized) ||
    SENSITIVE_HEADER_PARTS.some((part) => normalized.includes(part))
  );
}

export function redactSensitiveHeaders(
  headers: Record<string, string> | null,
): Record<string, string> {
  if (!headers) return {};
  return Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [
      name,
      isSensitiveHeader(name) ? REDACTED : value,
    ]),
  );
}
