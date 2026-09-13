import { expect } from "@std/expect";
import { afterEach, describe, test } from "@std/testing/bdd";
import { assertSpyCalls, spy } from "@std/testing/mock";

import type { ServiceContext } from "../../context";
import { getContentPageTool, searchContentTool } from "../content";

// Both tools ignore ctx — public content, workspace-independent.
const ctx = {} as ServiceContext;

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function mockFetch(response: Response) {
  const fn = spy(async () => response);
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
}

function searchFixture(i: number, type = "product") {
  return {
    metadata: {
      title: `Result ${i}`,
      description: `Description ${i}`,
      publishedAt: "2018-10-20T01:46:40.000Z",
      author: "openstatus",
    },
    type,
    content: `...snippet for result ${i}...`,
    slug: `page-${i}`,
    href: `/page-${i}?q=pricing#some-heading`,
    filePath: `/var/task/apps/web/src/content/pages/product/page-${i}.mdx`,
  };
}

describe("search_content", () => {
  test("defaults to the `all` corpus", async () => {
    const fn = mockFetch(Response.json([]));
    await searchContentTool.run({ ctx, input: { query: "pricing" } });
    assertSpyCalls(fn, 1);
    const url = String((fn.calls[0] as { args: unknown[] }).args[0]);
    expect(url).toContain("/api/search?p=all&q=pricing");
  });

  test("passes a narrowed type through", async () => {
    const fn = mockFetch(Response.json([]));
    await searchContentTool.run({
      ctx,
      input: { query: "pricing", type: "compare" },
    });
    const url = String((fn.calls[0] as { args: unknown[] }).args[0]);
    expect(url).toContain("/api/search?p=compare&q=pricing");
  });

  test("maps live response shape incl. type, strips query/hash/filePath", async () => {
    mockFetch(Response.json([searchFixture(1), searchFixture(2, "blog")]));
    const result = await searchContentTool.run({
      ctx,
      input: { query: "pricing", type: "all" },
    });
    const parsed = searchContentTool.outputSchema.safeParse(result);
    expect(parsed.success, parsed.error?.message).toBe(true);
    expect(result.results).toHaveLength(2);
    const first = result.results[0];
    expect(first.title).toBe("Result 1");
    expect(first.type).toBe("product");
    expect(first.path).toBe("page-1");
    expect(first.url).toBe(
      "https://www.openstatus.dev/page-1?q=pricing#some-heading",
    );
    expect(result.results[1].type).toBe("blog");
    expect(JSON.stringify(result)).not.toContain("filePath");
  });

  test("returns error shape on non-OK response without throwing", async () => {
    mockFetch(new Response("oops", { status: 500 }));
    const result = await searchContentTool.run({
      ctx,
      input: { query: "pricing", type: "all" },
    });
    expect(result.results).toEqual([]);
    expect(result.error).toBe("search unavailable (HTTP 500)");
    expect(searchContentTool.outputSchema.safeParse(result).success).toBe(true);
  });

  test("returns error shape when fetch throws", async () => {
    globalThis.fetch = (async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    const result = await searchContentTool.run({
      ctx,
      input: { query: "pricing", type: "all" },
    });
    expect(result.results).toEqual([]);
    expect(result.error).toBe("search unavailable (network error)");
  });

  test("caps results at 8", async () => {
    mockFetch(
      Response.json(Array.from({ length: 12 }, (_, i) => searchFixture(i))),
    );
    const result = await searchContentTool.run({
      ctx,
      input: { query: "pricing", type: "all" },
    });
    expect(result.results).toHaveLength(8);
  });
});

describe("get_content_page", () => {
  test("fetches any site page, not only docs", async () => {
    const fn = mockFetch(new Response("# Pricing\n\nPlans."));
    const result = await getContentPageTool.run({
      ctx,
      input: { path: "/pricing" },
    });
    const parsed = getContentPageTool.outputSchema.safeParse(result);
    expect(parsed.success, parsed.error?.message).toBe(true);
    expect(result.markdown).toBe("# Pricing\n\nPlans.");
    expect(result.truncated).toBe(false);
    expect(result.url).toBe("https://www.openstatus.dev/pricing");
    const url = String((fn.calls[0] as { args: unknown[] }).args[0]);
    expect(url).toBe("https://www.openstatus.dev/api/markdown/pricing");
  });

  test("truncates long pages with a marker", async () => {
    mockFetch(new Response("x".repeat(30_000)));
    const result = await getContentPageTool.run({
      ctx,
      input: { path: "blog/some-post" },
    });
    expect(result.truncated).toBe(true);
    expect(result.markdown.length).toBeLessThan(24_200);
    expect(
      result.markdown.endsWith(
        "[truncated — content continues at https://www.openstatus.dev/blog/some-post]",
      ),
    ).toBe(true);
  });

  test("returns error shape on 404", async () => {
    mockFetch(new Response("Not Found", { status: 404 }));
    const result = await getContentPageTool.run({
      ctx,
      input: { path: "compare/does-not-exist" },
    });
    expect(result.markdown).toBe("");
    expect(result.error).toBe("page not found (HTTP 404)");
  });

  test("rejects traversal, absolute urls and odd characters without fetching", async () => {
    const fn = mockFetch(new Response("should not be called"));
    for (const path of [
      "../etc",
      "docs/../../etc",
      "https://evil.example/x",
      "//evil.example/x",
      "pricing?x=1",
      "api/markdown/pricing#frag",
    ]) {
      const result = await getContentPageTool.run({ ctx, input: { path } });
      expect(result.markdown).toBe("");
      expect(result.error).toBe(
        "path must be a site-relative page path like docs/concept/monitor",
      );
      expect(getContentPageTool.outputSchema.safeParse(result).success).toBe(
        true,
      );
    }
    assertSpyCalls(fn, 0);
  });
});
