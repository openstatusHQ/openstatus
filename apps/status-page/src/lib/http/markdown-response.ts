import { withPoweredBy } from "../../content/markdown";
import { markdownCacheControl } from "../proxy/markdown-cache-control";
import { computeETag, isNotModified } from "./etag";

const MARKDOWN = "text/markdown; charset=utf-8";

export interface MarkdownResponseInit {
  body: string;
  source: string | null;
  whiteLabel: boolean;
  accessType: string | null | undefined;
}

export interface ResolvedMarkdownResponse {
  status: number;
  body: string | null;
  headers: Record<string, string>;
}

// Pure response shaping: append the powered-by footer, hash a strong ETag, and
// return a 304 (null body) when If-None-Match matches. `Vary: Accept` always —
// the same URL serves HTML or markdown by negotiation, so caches must split.
export function resolveMarkdownResponse(
  request: Request,
  { body, source, whiteLabel, accessType }: MarkdownResponseInit,
): ResolvedMarkdownResponse {
  const finalBody = withPoweredBy(body, whiteLabel);
  const etag = computeETag(finalBody);
  const headers = {
    "Content-Type": MARKDOWN,
    "Cache-Control": markdownCacheControl(source, accessType),
    ETag: etag,
    Vary: "Accept",
  };
  if (isNotModified(request, etag)) {
    return { status: 304, body: null, headers };
  }
  return { status: 200, body: finalBody, headers };
}
