import { createHash } from "node:crypto";

/** Strong ETag from a content hash. Node runtime only (uses node:crypto). */
export function computeETag(body: string): string {
  return `"${createHash("sha256").update(body).digest("hex")}"`;
}

/** Whether the request's If-None-Match matches the ETag — i.e. serve a 304. */
export function isNotModified(request: Request, etag: string): boolean {
  const header = request.headers.get("if-none-match");
  if (!header) return false;
  // RFC 7232 §3.2: `*` matches any current representation.
  if (header.trim() === "*") return true;
  return header.split(",").some((tag) => tag.trim() === etag);
}
