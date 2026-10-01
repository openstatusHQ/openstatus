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

// A bare `Bearer …` value or a JWT can sit anywhere in a non-JSON body.
const BEARER_PATTERN = /\bBearer\s+[\w.~+/=-]+/gi;
const JWT_PATTERN = /\beyJ[\w-]+\.[\w-]+\.[\w-]+/g;
// `token=…`, `"api_key": "…"`, `secret: …` in form-encoded or plain text bodies.
const KEY_VALUE_PATTERN =
  /\b([\w-]*(?:auth|cookie|credential|key|secret|session|token|password)[\w-]*)(["']?\s*[:=]\s*["']?)[^\s"'&,;}]+/gi;

function redactJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactJsonValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [
        key,
        isSensitiveHeader(key) || key.toLowerCase().includes("password")
          ? REDACTED
          : redactJsonValue(inner),
      ]),
    );
  }
  if (typeof value === "string") return redactText(value);
  return value;
}

function redactText(text: string): string {
  return text
    .replace(BEARER_PATTERN, `Bearer ${REDACTED}`)
    .replace(JWT_PATTERN, REDACTED)
    .replace(KEY_VALUE_PATTERN, `$1$2${REDACTED}`);
}

/**
 * Best-effort secret scrubbing for a checked endpoint's response body: JSON
 * values under sensitive keys, plus bearer tokens, JWTs and `key=value` pairs
 * in anything else. Bodies are third-party content, so callers that hand them
 * to an LLM should still treat the result as untrusted data.
 */
export function redactSensitiveBody(body: string | null): string | null {
  if (!body) return body;
  try {
    return JSON.stringify(redactJsonValue(JSON.parse(body)));
  } catch {
    return redactText(body);
  }
}
