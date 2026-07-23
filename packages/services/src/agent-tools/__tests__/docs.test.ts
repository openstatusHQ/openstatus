import { expect } from "@std/expect";
import { afterEach, describe, test } from "@std/testing/bdd";
import { assertSpyCalls, spy } from "@std/testing/mock";

import type { ServiceContext } from "../../context";
import { getDocPageTool, searchDocsTool } from "../docs";

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

function searchFixture(i: number) {
  return {
    metadata: {
      title: `Result ${i}`,
      description: `Description ${i}`,
      publishedAt: "2018-10-20T01:46:40.000Z",
      category: "Concepts",
      author: "openstatus",
    },
    content: `...snippet for result ${i}...`,
    slug: `concept/page-${i}`,
    href: `/docs/concept/page-${i}?q=monitor#some-heading`,
    filePath: `/var/task/apps/web/src/content/pages/docs/concept/page-${i}.mdx`,
  };
}

describe("search_docs", () => {
  test("maps live response shape, strips query/hash/filePath", async () => {
    mockFetch(Response.json([searchFixture(1), searchFixture(2)]));
    const result = await searchDocsTool.run({
      ctx,
      input: { query: "monitor", type: "docs" },
    });
    const parsed = searchDocsTool.outputSchema.safeParse(result);
    expect(parsed.success, parsed.error?.message).toBe(true);
    expect(result.results).toHaveLength(2);
    const first = result.results[0];
    expect(first.title).toBe("Result 1");
    expect(first.path).toBe("docs/concept/page-1");
    expect(first.url).toBe(
      "https://www.openstatus.dev/docs/concept/page-1?q=monitor#some-heading",
    );
    expect(JSON.stringify(result)).not.toContain("filePath");
  });

  test("returns error shape on non-OK response without throwing", async () => {
    mockFetch(new Response("oops", { status: 500 }));
    const result = await searchDocsTool.run({
      ctx,
      input: { query: "monitor", type: "docs" },
    });
    expect(result.results).toEqual([]);
    expect(result.error).toBe("search unavailable (HTTP 500)");
    expect(searchDocsTool.outputSchema.safeParse(result).success).toBe(true);
  });

  test("returns error shape when fetch throws", async () => {
    globalThis.fetch = (async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    const result = await searchDocsTool.run({
      ctx,
      input: { query: "monitor", type: "docs" },
    });
    expect(result.results).toEqual([]);
    expect(result.error).toBe("search unavailable (network error)");
    expect(searchDocsTool.outputSchema.safeParse(result).success).toBe(true);
  });

  test("caps results at 8", async () => {
    mockFetch(
      Response.json(Array.from({ length: 12 }, (_, i) => searchFixture(i))),
    );
    const result = await searchDocsTool.run({
      ctx,
      input: { query: "monitor", type: "docs" },
    });
    expect(result.results).toHaveLength(8);
  });
});

describe("get_doc_page", () => {
  test("returns markdown body untruncated", async () => {
    mockFetch(new Response("# Hello\n\nSome docs content."));
    const result = await getDocPageTool.run({
      ctx,
      input: { path: "docs/concept/page-1" },
    });
    const parsed = getDocPageTool.outputSchema.safeParse(result);
    expect(parsed.success, parsed.error?.message).toBe(true);
    expect(result.markdown).toBe("# Hello\n\nSome docs content.");
    expect(result.truncated).toBe(false);
    expect(result.url).toBe("https://www.openstatus.dev/docs/concept/page-1");
  });

  test("truncates long pages with a marker", async () => {
    mockFetch(new Response("x".repeat(30_000)));
    const result = await getDocPageTool.run({
      ctx,
      input: { path: "docs/concept/page-1" },
    });
    expect(result.truncated).toBe(true);
    expect(result.markdown.length).toBeLessThan(24_200);
    expect(
      result.markdown.endsWith(
        "[truncated — content continues at https://www.openstatus.dev/docs/concept/page-1]",
      ),
    ).toBe(true);
  });

  test("returns error shape on 404", async () => {
    mockFetch(new Response("Not Found", { status: 404 }));
    const result = await getDocPageTool.run({
      ctx,
      input: { path: "docs/does-not-exist" },
    });
    expect(result.markdown).toBe("");
    expect(result.error).toBe("page not found (HTTP 404)");
  });

  test("returns error shape when fetch throws", async () => {
    globalThis.fetch = (async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    const result = await getDocPageTool.run({
      ctx,
      input: { path: "docs/concept/page-1" },
    });
    expect(result.markdown).toBe("");
    expect(result.error).toBe("page unavailable (network error)");
    expect(getDocPageTool.outputSchema.safeParse(result).success).toBe(true);
  });

  test("rejects non-allowlisted paths without fetching", async () => {
    const fn = mockFetch(new Response("should not be called"));
    for (const path of ["blog/foo", "../etc", "docs/../../etc"]) {
      const result = await getDocPageTool.run({ ctx, input: { path } });
      expect(result.markdown).toBe("");
      expect(result.error).toBe(
        "path must start with docs/, guides/ or changelog/",
      );
      expect(getDocPageTool.outputSchema.safeParse(result).success).toBe(true);
    }
    assertSpyCalls(fn, 0);
  });
});
