import { db, eq, like } from "@openstatus/db";
import { externalService } from "@openstatus/db/src/schema";
import { expect } from "@std/expect";
import { afterEach, describe, test } from "@std/testing/bdd";

import { applyDetectedProvider } from "../update-provider";

const TEST_PREFIX = "svc-updprov-test";

afterEach(async () => {
  await db
    .delete(externalService)
    .where(like(externalService.slug, `${TEST_PREFIX}-%`))
    .run();
});

async function insertService(args: {
  slug: string;
  provider?: "atlassian-statuspage" | "instatus";
  apiConfig?: { type: "atlassian"; endpoint?: string } | null;
  deletedAt?: Date;
}) {
  const rows = await db
    .insert(externalService)
    .values({
      slug: args.slug,
      aliases: [],
      name: "Svc",
      url: "https://example.com",
      statusPageUrl: "https://status.example.com",
      provider: args.provider ?? "atlassian-statuspage",
      industry: ["saas"],
      apiConfig: args.apiConfig ?? undefined,
      deletedAt: args.deletedAt,
    })
    .returning({ id: externalService.id });
  const row = rows[0];
  if (!row) throw new Error("insert failed");
  return row.id;
}

async function fetchService(id: number) {
  const rows = await db
    .select()
    .from(externalService)
    .where(eq(externalService.id, id))
    .all();
  const row = rows[0];
  if (!row) throw new Error("row missing");
  return row;
}

describe("applyDetectedProvider", () => {
  test("updates provider, clears apiConfig, bumps updatedAt", async () => {
    const id = await insertService({
      slug: `${TEST_PREFIX}-apply`,
      apiConfig: { type: "atlassian", endpoint: "https://old.example.com" },
    });
    const now = new Date(Date.now() + 60_000);

    const result = await applyDetectedProvider({
      input: {
        serviceId: id,
        expected: {
          provider: "atlassian-statuspage",
          apiConfig: { type: "atlassian", endpoint: "https://old.example.com" },
        },
        set: { provider: "instatus", apiConfig: null },
      },
      now,
    });

    expect(result.updated).toBe(true);
    const row = await fetchService(id);
    expect(row.provider).toBe("instatus");
    expect(row.apiConfig).toBeNull();
    expect(row.updatedAt?.getTime()).toBe(
      Math.floor(now.getTime() / 1000) * 1000,
    );
  });

  test("skips when provider changed concurrently", async () => {
    const id = await insertService({
      slug: `${TEST_PREFIX}-race`,
      provider: "instatus",
    });

    const result = await applyDetectedProvider({
      input: {
        serviceId: id,
        expected: { provider: "atlassian-statuspage", apiConfig: null },
        set: { provider: "instatus", apiConfig: null },
      },
    });

    expect(result.updated).toBe(false);
    const row = await fetchService(id);
    expect(row.provider).toBe("instatus");
  });

  test("skips when apiConfig changed concurrently", async () => {
    const id = await insertService({
      slug: `${TEST_PREFIX}-cfgrace`,
      apiConfig: { type: "atlassian", endpoint: "https://new.example.com" },
    });

    const result = await applyDetectedProvider({
      input: {
        serviceId: id,
        expected: { provider: "atlassian-statuspage", apiConfig: null },
        set: { provider: "instatus", apiConfig: null },
      },
    });

    expect(result.updated).toBe(false);
    const row = await fetchService(id);
    expect(row.apiConfig).toEqual({
      type: "atlassian",
      endpoint: "https://new.example.com",
    });
  });

  test("clears a stale apiConfig keeping the same provider", async () => {
    const id = await insertService({
      slug: `${TEST_PREFIX}-cfgfix`,
      apiConfig: { type: "atlassian", endpoint: "https://stale.example.com" },
    });

    const result = await applyDetectedProvider({
      input: {
        serviceId: id,
        expected: {
          provider: "atlassian-statuspage",
          apiConfig: {
            type: "atlassian",
            endpoint: "https://stale.example.com",
          },
        },
        set: { provider: "atlassian-statuspage", apiConfig: null },
      },
    });

    expect(result.updated).toBe(true);
    const row = await fetchService(id);
    expect(row.provider).toBe("atlassian-statuspage");
    expect(row.apiConfig).toBeNull();
  });

  test("skips soft-deleted rows", async () => {
    const id = await insertService({
      slug: `${TEST_PREFIX}-deleted`,
      deletedAt: new Date(),
    });

    const result = await applyDetectedProvider({
      input: {
        serviceId: id,
        expected: { provider: "atlassian-statuspage", apiConfig: null },
        set: { provider: "instatus", apiConfig: null },
      },
    });

    expect(result.updated).toBe(false);
  });
});
