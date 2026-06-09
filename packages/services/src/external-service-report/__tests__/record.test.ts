import { afterEach, describe, expect, test } from "bun:test";

import { db, eq, like } from "@openstatus/db";
import {
  externalService,
  externalServiceComponent,
} from "@openstatus/db/src/schema";
import { OSTinybird } from "@openstatus/tinybird";

import { NotFoundError } from "../../errors";
import { recordExternalServiceReport } from "../record";

const TEST_PREFIX = "svc-extreport-test";
// Empty token → NoopTinybird, so publish/read resolve without a network call.
const tb = new OSTinybird("");

afterEach(async () => {
  const rows = await db
    .select({ id: externalService.id })
    .from(externalService)
    .where(like(externalService.slug, `${TEST_PREFIX}-%`))
    .all();
  for (const row of rows) {
    await db
      .delete(externalServiceComponent)
      .where(eq(externalServiceComponent.externalServiceId, row.id))
      .run();
  }
  await db
    .delete(externalService)
    .where(like(externalService.slug, `${TEST_PREFIX}-%`))
    .run();
});

async function seedService(args: {
  slug: string;
  aliases?: string[];
  deletedAt?: Date | null;
}) {
  const [row] = await db
    .insert(externalService)
    .values({
      slug: args.slug,
      aliases: args.aliases ?? [],
      name: "Report svc",
      url: "https://example.com",
      statusPageUrl: "https://status.example.com",
      provider: "atlassian-statuspage",
      industry: [],
      deletedAt: args.deletedAt ?? null,
    })
    .returning();
  return row;
}

describe("recordExternalServiceReport", () => {
  test("records a service-level report keyed by the canonical slug", async () => {
    await seedService({ slug: `${TEST_PREFIX}-live` });
    const result = await recordExternalServiceReport({
      tb,
      input: {
        slug: `${TEST_PREFIX}-live`,
        reporterHash: "hash",
        country: "FR",
        reportedAt: 1,
      },
    });
    expect(result).toEqual({
      serviceSlug: `${TEST_PREFIX}-live`,
      componentId: "",
    });
  });

  test("resolves an alias slug to the canonical slug", async () => {
    await seedService({
      slug: `${TEST_PREFIX}-canonical`,
      aliases: [`${TEST_PREFIX}-old`],
    });
    const result = await recordExternalServiceReport({
      tb,
      input: {
        slug: `${TEST_PREFIX}-old`,
        reporterHash: "hash",
        country: "",
        reportedAt: 1,
      },
    });
    expect(result.serviceSlug).toBe(`${TEST_PREFIX}-canonical`);
  });

  test("throws for an unknown service", async () => {
    await expect(
      recordExternalServiceReport({
        tb,
        input: {
          slug: `${TEST_PREFIX}-missing`,
          reporterHash: "hash",
          country: "",
          reportedAt: 1,
        },
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  test("throws for a soft-deleted service", async () => {
    await seedService({
      slug: `${TEST_PREFIX}-gone`,
      deletedAt: new Date(),
    });
    await expect(
      recordExternalServiceReport({
        tb,
        input: {
          slug: `${TEST_PREFIX}-gone`,
          reporterHash: "hash",
          country: "",
          reportedAt: 1,
        },
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  test("records a component-level report keyed by the DB component id", async () => {
    const service = await seedService({ slug: `${TEST_PREFIX}-withcomp` });
    const [component] = await db
      .insert(externalServiceComponent)
      .values({
        externalServiceId: service.id,
        upstreamComponentId: "upstream-1",
        slug: "api",
        name: "API",
        indicator: "none",
        status: "operational",
      })
      .returning();

    const result = await recordExternalServiceReport({
      tb,
      input: {
        slug: `${TEST_PREFIX}-withcomp`,
        componentSlug: "api",
        reporterHash: "hash",
        country: "DE",
        reportedAt: 1,
      },
    });
    expect(result.componentId).toBe(String(component.id));
  });

  test("throws for an unknown component", async () => {
    await seedService({ slug: `${TEST_PREFIX}-nocomp` });
    await expect(
      recordExternalServiceReport({
        tb,
        input: {
          slug: `${TEST_PREFIX}-nocomp`,
          componentSlug: "does-not-exist",
          reporterHash: "hash",
          country: "",
          reportedAt: 1,
        },
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
