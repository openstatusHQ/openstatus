import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import type { MDXData } from "../../content/utils";
import {
  BASE_URL,
  getHomeMetadata,
  getPageMetadata,
  getSocialMetadata,
} from "./shared-metadata";

type Seo = NonNullable<MDXData["metadata"]["seo"]>;

// safe because the helpers only read slug and metadata
function page(seo?: Seo, updatedAt?: Date): MDXData {
  return {
    slug: "my-post",
    content: "",
    metadata: {
      title: "My Post",
      description: "About my post",
      category: "engineering",
      publishedAt: new Date("2024-01-02T00:00:00Z"),
      updatedAt,
      seo,
    },
  } as unknown as MDXData;
}

function twitterImage(meta: ReturnType<typeof getSocialMetadata>) {
  return (meta.twitter?.images as string[] | undefined)?.[0] ?? "";
}

describe("getSocialMetadata", () => {
  test("builds an og image url from title, description and category", () => {
    const meta = getSocialMetadata({
      title: "A & B",
      description: "desc",
      url: "https://x.test",
      category: "blog",
    });
    const image = twitterImage(meta);
    const params = new URL(image).searchParams;
    expect(image.startsWith(`${BASE_URL}/api/og?`)).toBe(true);
    expect(Object.fromEntries(params)).toEqual({
      title: "A & B",
      description: "desc",
      category: "blog",
    });
    expect(meta.openGraph).toMatchObject({
      url: "https://x.test",
      type: "website",
    });
  });

  test("omits category when absent", () => {
    const image = twitterImage(
      getSocialMetadata({ title: "t", description: "d", url: "u" }),
    );
    expect(new URL(image).searchParams.has("category")).toBe(false);
  });

  test("uses an explicit og image as is", () => {
    const { openGraph, twitter } = getSocialMetadata({
      title: "t",
      description: "d",
      url: "u",
      ogImage: "/custom.png",
    });
    expect(openGraph?.images).toEqual([{ url: "/custom.png" }]);
    expect(twitter?.images).toEqual(["/custom.png"]);
  });
});

describe("getPageMetadata", () => {
  test("derives title, canonical and article dates", () => {
    const meta = getPageMetadata(page(), "blog");
    expect(meta.title).toBe("My Post");
    expect(meta.description).toBe("About my post");
    expect(meta.alternates?.canonical).toBe(`${BASE_URL}/blog/my-post`);
    expect(meta.robots).toBeUndefined();
    expect(meta.openGraph).toMatchObject({
      type: "article",
      publishedTime: "2024-01-02T00:00:00.000Z",
      modifiedTime: "2024-01-02T00:00:00.000Z",
    });
  });

  test("uses the slug at the root without a base path", () => {
    expect(getPageMetadata(page()).alternates?.canonical).toBe(
      `${BASE_URL}/my-post`,
    );
  });

  test("uses updatedAt as the modified time", () => {
    const meta = getPageMetadata(
      page(undefined, new Date("2024-03-04T00:00:00Z")),
    );
    expect(meta.openGraph).toMatchObject({
      modifiedTime: "2024-03-04T00:00:00.000Z",
    });
  });

  test("applies seo overrides", () => {
    const meta = getPageMetadata(
      page({
        title: "SEO Title",
        description: "SEO desc",
        canonical: "https://elsewhere.test/post",
        noindex: true,
      }),
    );
    expect(meta.title).toEqual({ absolute: "SEO Title" });
    expect(meta.description).toBe("SEO desc");
    expect(meta.alternates?.canonical).toBe("https://elsewhere.test/post");
    expect(meta.robots).toEqual({ index: false });
    expect(meta.openGraph?.title).toBe("SEO Title");
  });
});

describe("getHomeMetadata", () => {
  test("bypasses the title template and uses the static og image", () => {
    const meta = getHomeMetadata(page());
    expect(meta.title).toEqual({ absolute: "My Post" });
    expect(meta.alternates?.canonical).toBe("/");
    expect(meta.twitter?.images).toEqual([`${BASE_URL}/api/og`]);
    expect(meta.openGraph?.url).toBe(BASE_URL);
  });

  test("applies seo overrides", () => {
    const meta = getHomeMetadata(
      page({ title: "Home SEO", canonical: "/home", noindex: true }),
    );
    expect(meta.title).toEqual({ absolute: "Home SEO" });
    expect(meta.alternates?.canonical).toBe("/home");
    expect(meta.robots).toEqual({ index: false });
  });
});
