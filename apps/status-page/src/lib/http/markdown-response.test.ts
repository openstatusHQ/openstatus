import { describe, expect, test } from "bun:test";

import { withPoweredBy } from "@/content/markdown";
import { computeETag } from "@/lib/http/etag";
import { resolveMarkdownResponse } from "@/lib/http/markdown-response";

const PUBLIC_CACHE =
  "public, max-age=60, s-maxage=60, stale-while-revalidate=300";
const NO_STORE = "private, no-store";

function req(ifNoneMatch?: string): Request {
  return new Request("https://acme.openstatus.dev/.md", {
    headers: ifNoneMatch ? { "if-none-match": ifNoneMatch } : {},
  });
}

describe("resolveMarkdownResponse", () => {
  test("200: appends powered-by footer, markdown content-type, Vary: Accept", () => {
    const res = resolveMarkdownResponse(req(), {
      body: "# Status",
      source: "suffix",
      whiteLabel: false,
      accessType: "public",
    });
    expect(res.status).toBe(200);
    expect(res.body).toBe(withPoweredBy("# Status", false));
    expect(res.body).toContain("Powered by");
    expect(res.headers["Content-Type"]).toBe("text/markdown; charset=utf-8");
    expect(res.headers.Vary).toBe("Accept");
    expect(res.headers.ETag).toMatch(/^"[0-9a-f]{64}"$/);
  });

  test("ETag is hashed over the footer-appended body, not the raw body", () => {
    const res = resolveMarkdownResponse(req(), {
      body: "# Status",
      source: "suffix",
      whiteLabel: false,
      accessType: "public",
    });
    expect(res.headers.ETag).toBe(
      computeETag(withPoweredBy("# Status", false)),
    );
  });

  test("white-labeled: no footer, and a different ETag", () => {
    const plain = resolveMarkdownResponse(req(), {
      body: "# Status",
      source: "suffix",
      whiteLabel: false,
      accessType: "public",
    });
    const wl = resolveMarkdownResponse(req(), {
      body: "# Status",
      source: "suffix",
      whiteLabel: true,
      accessType: "public",
    });
    expect(wl.body).toBe("# Status");
    expect(wl.body).not.toContain("Powered by");
    expect(wl.headers.ETag).not.toBe(plain.headers.ETag);
  });

  test("304 when If-None-Match matches the footer-appended ETag, body null", () => {
    const etag = computeETag(withPoweredBy("# Status", false));
    const res = resolveMarkdownResponse(req(etag), {
      body: "# Status",
      source: "suffix",
      whiteLabel: false,
      accessType: "public",
    });
    expect(res.status).toBe(304);
    expect(res.body).toBeNull();
    // Cache + ETag + Vary still ride along on the 304.
    expect(res.headers.ETag).toBe(etag);
    expect(res.headers.Vary).toBe("Accept");
    expect(res.headers["Cache-Control"]).toBe(PUBLIC_CACHE);
  });

  test("public .md suffix is edge-cacheable", () => {
    const res = resolveMarkdownResponse(req(), {
      body: "x",
      source: "suffix",
      whiteLabel: false,
      accessType: "public",
    });
    expect(res.headers["Cache-Control"]).toBe(PUBLIC_CACHE);
  });

  test("gated page is never edge-cacheable, even via .md suffix", () => {
    const res = resolveMarkdownResponse(req(), {
      body: "x",
      source: "suffix",
      whiteLabel: false,
      accessType: "password",
    });
    expect(res.headers["Cache-Control"]).toBe(NO_STORE);
  });

  test("header-negotiated public page is not edge-cached", () => {
    const res = resolveMarkdownResponse(req(), {
      body: "x",
      source: "header",
      whiteLabel: false,
      accessType: "public",
    });
    expect(res.headers["Cache-Control"]).toBe(NO_STORE);
  });
});
