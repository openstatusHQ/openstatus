import { redactSensitiveHeaders } from "@openstatus/services/monitor";

export const MAX_BODY_BYTES = 10 * 1024;
export const MAX_HEADERS_BYTES = 4 * 1024;
export const MAX_USER_AGENT_LENGTH = 256;

const REDACTED = "[redacted]";
const DROPPED_HEADERS = new Set([
  "x-real-ip",
  "via",
  "cdn-loop",
  "host",
  "content-length",
]);
const DROPPED_PREFIXES = ["fly-", "x-forwarded-"];
const SENSITIVE_NAME = /token|secret|key|password|signature/i;

/** Redacted, infrastructure noise removed, serialised and cut at 4 KB. */
export function captureHeaders(headers: Headers): string | null {
  const kept: Record<string, string> = {};
  headers.forEach((value, rawName) => {
    const name = rawName.toLowerCase();
    if (DROPPED_HEADERS.has(name)) return;
    if (DROPPED_PREFIXES.some((p) => name.startsWith(p))) return;
    kept[name] = SENSITIVE_NAME.test(name) ? REDACTED : value;
  });
  const redacted = redactSensitiveHeaders(kept);
  if (Object.keys(redacted).length === 0) return null;
  return truncateUtf8(JSON.stringify(redacted), MAX_HEADERS_BYTES).text;
}

export function captureUserAgent(headers: Headers): string | null {
  const ua = headers.get("user-agent");
  return ua ? ua.slice(0, MAX_USER_AGENT_LENGTH) : null;
}

/** Fly sets `fly-client-ip`; otherwise only the last forwarded hop is ours. */
export function captureIp(headers: Headers): string | null {
  const fly = headers.get("fly-client-ip");
  if (fly) return fly;
  const forwarded = headers.get("x-forwarded-for");
  return forwarded?.split(",").at(-1)?.trim() || null;
}

/** Reads at most `limit` bytes and cancels the rest, so a huge POST is never buffered. */
export async function readCappedBody(
  request: Request,
  limit = MAX_BODY_BYTES,
): Promise<{ body: string | null; truncated: boolean }> {
  if (!request.body) return { body: null, truncated: false };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let truncated = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const room = limit - size;
    if (value.byteLength > room) {
      chunks.push(value.subarray(0, room));
      size = limit;
      truncated = true;
      await reader.cancel();
      break;
    }
    chunks.push(value);
    size += value.byteLength;
  }
  if (size === 0) return { body: null, truncated };

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  // a cut may land inside a multi-byte character; drop the partial one
  return {
    body: new TextDecoder("utf-8", { fatal: false })
      .decode(bytes)
      .replace(/�$/, ""),
    truncated,
  };
}

function truncateUtf8(text: string, limit: number) {
  const bytes = new TextEncoder().encode(text);
  if (bytes.byteLength <= limit) return { text, truncated: false };
  return {
    text: new TextDecoder()
      .decode(bytes.subarray(0, limit))
      .replace(/�$/, ""),
    truncated: true,
  };
}

/** Ping URLs carry the token; keep it out of request logs. */
export function redactHeartbeatToken(pathOrUrl: string): string {
  return pathOrUrl.replace(/\/heartbeat\/[^/?#]+/, "/heartbeat/[redacted]");
}
