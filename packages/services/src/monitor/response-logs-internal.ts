const REDACTED = "[redacted]";

const SENSITIVE_HEADER_NAMES = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "proxy-authorization",
  "x-api-key",
  "x-auth-token",
]);

// Matched against whole words of a name split on `-`, `_` and camelCase, so
// `api_key`, `accessToken` and `x-auth-token` match but `monkey` does not.
const SENSITIVE_WORD =
  /^(?:auth(?:orization|entication|n|z)?|cookies?|credentials?|keys?|secrets?|sessions?|tokens?|passwords?|passwd)$/;

// Common sensitive names written as a single lowercase word.
const SENSITIVE_COMPOUND_WORDS = new Set([
  "apikey",
  "accesskey",
  "secretkey",
  "privatekey",
  "accesstoken",
  "refreshtoken",
  "idtoken",
  "authtoken",
  "clientsecret",
  "sessionid",
]);

function isSensitiveName(name: string) {
  if (SENSITIVE_HEADER_NAMES.has(name.toLowerCase())) return true;
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .some(
      (word) => SENSITIVE_WORD.test(word) || SENSITIVE_COMPOUND_WORDS.has(word),
    );
}

export function redactSensitiveHeaders(
  headers: Record<string, string> | null,
): Record<string, string> {
  if (!headers) return {};
  return Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [
      name,
      isSensitiveName(name) ? REDACTED : value,
    ]),
  );
}

// A bare `Bearer …` value or a JWT can sit anywhere in a non-JSON body.
const BEARER_PATTERN = /\bBearer\s+[\w.~+/=-]+/gi;
const JWT_PATTERN = /\beyJ[\w-]+\.[\w-]+\.[\w-]+/g;
// `token=…`, `"api_key": "…"`, `secret: …` in form-encoded or plain text bodies.
// The pattern only pre-filters candidate keys; `isSensitiveName` decides.
// Quoted values are consumed whole so secrets containing spaces don't leak.
const KEY_VALUE_PATTERN =
  /\b([\w-]*(?:auth|cookie|credential|key|secret|session|token|passw)[\w-]*)(["']?\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s"'&,;}]+)/gi;

function redactJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactJsonValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [
        key,
        isSensitiveName(key) ? REDACTED : redactJsonValue(inner),
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
    .replace(
      KEY_VALUE_PATTERN,
      (match, key: string, sep: string, value: string) => {
        if (!isSensitiveName(key)) return match;
        const quote = value[0] === '"' || value[0] === "'" ? value[0] : "";
        return `${key}${sep}${quote}${REDACTED}${quote}`;
      },
    );
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
