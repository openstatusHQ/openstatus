export interface DetectMarkdownResult {
  wantsMarkdown: boolean;
  source: "suffix" | "header" | null;
  /** Pathname with a trailing `.md` stripped, so `resolveRoute` runs unchanged. */
  pathname: string;
}

function acceptsMarkdown(accept: string | null): boolean {
  if (!accept) return false;
  // Match the media type as a whole token, tolerating params/q-values and casing.
  return accept
    .toLowerCase()
    .split(",")
    .some((part) => part.trim().split(";")[0].trim() === "text/markdown");
}

/**
 * Proxy-side detection of a markdown request. The `.md` suffix wins over the
 * Accept header so a `.md` URL keeps the cache-safe suffix policy.
 */
export function detectMarkdown(input: {
  pathname: string;
  accept: string | null;
}): DetectMarkdownResult {
  const { pathname, accept } = input;

  if (pathname.endsWith(".md")) {
    const stripped = pathname.slice(0, -".md".length);
    // `/.md` (root) → `/`; otherwise keep the stripped path.
    return {
      wantsMarkdown: true,
      source: "suffix",
      pathname: stripped === "" ? "/" : stripped,
    };
  }

  if (acceptsMarkdown(accept)) {
    return { wantsMarkdown: true, source: "header", pathname };
  }

  return { wantsMarkdown: false, source: null, pathname };
}
