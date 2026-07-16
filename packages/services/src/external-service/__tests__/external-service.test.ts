import { db, like, sql } from "@openstatus/db";
import { externalService } from "@openstatus/db/src/schema";
import { expect } from "@std/expect";
import { afterEach, describe, test } from "@std/testing/bdd";

import { ConflictError } from "../../errors";
import { assertSlugAvailable } from "../internal";
import { getExternalServiceBySlug, listExternalServices } from "../list";
import { listExternalServiceSlugs } from "../list-slugs";

const TEST_PREFIX = "svc-extsvc-test";

afterEach(async () => {
  await db
    .delete(externalService)
    .where(like(externalService.slug, `${TEST_PREFIX}-%`))
    .run();
});

describe("listExternalServices", () => {
  test("returns only live rows by default", async () => {
    await db
      .insert(externalService)
      .values([
        {
          slug: `${TEST_PREFIX}-live`,
          aliases: [],
          name: "Live svc",
          url: "https://example.com",
          statusPageUrl: "https://status.example.com",
          provider: "atlassian-statuspage",
          industry: ["saas"],
        },
        {
          slug: `${TEST_PREFIX}-dead`,
          aliases: [],
          name: "Dead svc",
          url: "https://example.com",
          statusPageUrl: "https://status.example.com",
          provider: "atlassian-statuspage",
          industry: ["saas"],
          deletedAt: new Date(),
        },
      ])
      .run();

    const live = await listExternalServices({});
    expect(live.find((s) => s.slug === `${TEST_PREFIX}-live`)).toBeDefined();
    expect(live.find((s) => s.slug === `${TEST_PREFIX}-dead`)).toBeUndefined();

    const all = await listExternalServices({
      input: { includeDeleted: true },
    });
    expect(all.find((s) => s.slug === `${TEST_PREFIX}-dead`)).toBeDefined();
  });

  test("omits rows with invalid apiConfig and warns", async () => {
    const originalWarn = console.warn;
    let warned = false;
    console.warn = () => {
      warned = true;
    };
    try {
      // Bypass column type to write deliberately invalid JSON for the test.
      await db.run(
        sql`INSERT INTO external_service (slug, aliases, name, url, status_page_url, provider, industry, api_config)
            VALUES (${`${TEST_PREFIX}-badcfg`}, json_array(), 'Bad cfg', 'https://example.com',
                    'https://status.example.com', 'custom', json_array('saas'),
                    json_object('type', 'nonsense'))`,
      );
      const rows = await listExternalServices({});
      expect(
        rows.find((r) => r.slug === `${TEST_PREFIX}-badcfg`),
      ).toBeUndefined();
      expect(warned).toBe(true);
    } finally {
      console.warn = originalWarn;
    }
  });
});

describe("getExternalServiceBySlug", () => {
  test("resolves by canonical slug", async () => {
    await db
      .insert(externalService)
      .values({
        slug: `${TEST_PREFIX}-canon`,
        aliases: [`${TEST_PREFIX}-old`],
        name: "Canon",
        url: "https://example.com",
        statusPageUrl: "https://status.example.com",
        provider: "atlassian-statuspage",
        industry: ["saas"],
      })
      .run();

    const row = await getExternalServiceBySlug({
      slug: `${TEST_PREFIX}-canon`,
    });
    expect(row?.slug).toBe(`${TEST_PREFIX}-canon`);
  });

  test("resolves by alias to the canonical row", async () => {
    await db
      .insert(externalService)
      .values({
        slug: `${TEST_PREFIX}-canon`,
        aliases: [`${TEST_PREFIX}-old`],
        name: "Canon",
        url: "https://example.com",
        statusPageUrl: "https://status.example.com",
        provider: "atlassian-statuspage",
        industry: ["saas"],
      })
      .run();

    const row = await getExternalServiceBySlug({
      slug: `${TEST_PREFIX}-old`,
    });
    expect(row?.slug).toBe(`${TEST_PREFIX}-canon`);
  });

  test("returns null for an unknown slug", async () => {
    const row = await getExternalServiceBySlug({
      slug: `${TEST_PREFIX}-nonexistent`,
    });
    expect(row).toBeNull();
  });
});

describe("listExternalServiceSlugs", () => {
  test("returns canonical slugs and aliases mapped to canonicals", async () => {
    await db
      .insert(externalService)
      .values({
        slug: `${TEST_PREFIX}-x`,
        aliases: [`${TEST_PREFIX}-twitter`, `${TEST_PREFIX}-old-twitter`],
        name: "X",
        url: "https://example.com",
        statusPageUrl: "https://status.example.com",
        provider: "atlassian-statuspage",
        industry: ["saas"],
      })
      .run();
    const map = await listExternalServiceSlugs({});
    expect(map.canonical).toContain(`${TEST_PREFIX}-x`);
    const xAliases = map.aliases.filter((a) => a.to === `${TEST_PREFIX}-x`);
    expect(xAliases.map((a) => a.from).sort()).toEqual(
      [`${TEST_PREFIX}-old-twitter`, `${TEST_PREFIX}-twitter`].sort(),
    );
  });
});

describe("assertSlugAvailable", () => {
  test("throws when the slug equals another row's canonical slug", async () => {
    const [inserted] = await db
      .insert(externalService)
      .values({
        slug: `${TEST_PREFIX}-canon`,
        aliases: [],
        name: "Canon",
        url: "https://example.com",
        statusPageUrl: "https://status.example.com",
        provider: "atlassian-statuspage",
        industry: ["saas"],
      })
      .returning({ id: externalService.id })
      .all();
    if (!inserted) throw new Error("insert failed");
    await expect(
      assertSlugAvailable({ tx: db, slug: `${TEST_PREFIX}-canon` }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  test("throws when the slug appears in another row's aliases", async () => {
    await db
      .insert(externalService)
      .values({
        slug: `${TEST_PREFIX}-canon`,
        aliases: [`${TEST_PREFIX}-old`],
        name: "Canon",
        url: "https://example.com",
        statusPageUrl: "https://status.example.com",
        provider: "atlassian-statuspage",
        industry: ["saas"],
      })
      .run();
    await expect(
      assertSlugAvailable({ tx: db, slug: `${TEST_PREFIX}-old` }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  test("does not throw when the existing row is excluded", async () => {
    const [inserted] = await db
      .insert(externalService)
      .values({
        slug: `${TEST_PREFIX}-canon`,
        aliases: [],
        name: "Canon",
        url: "https://example.com",
        statusPageUrl: "https://status.example.com",
        provider: "atlassian-statuspage",
        industry: ["saas"],
      })
      .returning({ id: externalService.id })
      .all();
    if (!inserted) throw new Error("insert failed");
    await assertSlugAvailable({
      tx: db,
      slug: `${TEST_PREFIX}-canon`,
      exceptServiceId: inserted.id,
    });
    expect(true).toBe(true);
  });

  test("does not throw when the slug is genuinely free", async () => {
    await assertSlugAvailable({
      tx: db,
      slug: `${TEST_PREFIX}-free-${Date.now()}`,
    });
    expect(true).toBe(true);
  });
});
