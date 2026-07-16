import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import { statusPageAlternates } from "./alternates";

describe("statusPageAlternates", () => {
  test("subdomain, default markdown path → overview", () => {
    expect(statusPageAlternates({ slug: "acme" })).toEqual({
      canonical: "https://acme.openstatus.dev",
      types: {
        "text/markdown": "https://acme.openstatus.dev/.md",
        "application/json":
          "https://acme.openstatus.dev/api/status/summary.json",
      },
    });
  });

  test("custom domain wins over subdomain", () => {
    expect(
      statusPageAlternates({ slug: "acme", customDomain: "status.acme.com" }),
    ).toEqual({
      canonical: "https://status.acme.com",
      types: {
        "text/markdown": "https://status.acme.com/.md",
        "application/json": "https://status.acme.com/api/status/summary.json",
      },
    });
  });

  test("null customDomain falls back to subdomain", () => {
    expect(statusPageAlternates({ slug: "acme", customDomain: null })).toEqual({
      canonical: "https://acme.openstatus.dev",
      types: {
        "text/markdown": "https://acme.openstatus.dev/.md",
        "application/json":
          "https://acme.openstatus.dev/api/status/summary.json",
      },
    });
  });

  test("per-page markdown path, subdomain", () => {
    const result = statusPageAlternates({
      slug: "acme",
      markdownPath: "/monitors/123.md",
    });
    expect(result?.types?.["text/markdown"]).toBe(
      "https://acme.openstatus.dev/monitors/123.md",
    );
    // canonical and json alternate stay at the page root regardless of md path
    expect(result?.canonical).toBe("https://acme.openstatus.dev");
    expect(result?.types?.["application/json"]).toBe(
      "https://acme.openstatus.dev/api/status/summary.json",
    );
  });

  test("per-page markdown path, custom domain", () => {
    expect(
      statusPageAlternates({
        slug: "acme",
        customDomain: "status.acme.com",
        markdownPath: "/events/report/7.md",
      })?.types?.["text/markdown"],
    ).toBe("https://status.acme.com/events/report/7.md");
  });
});
