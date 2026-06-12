import { afterEach, describe, expect, test } from "bun:test";

import { db, eq, inArray, like } from "@openstatus/db";
import {
  externalService,
  externalServiceComponent,
  externalServiceReport,
} from "@openstatus/db/src/schema";

import { NotFoundError } from "../../errors";
import {
  getComponentReportWindows,
  getServiceReportCountries,
  getServiceReportDaily,
  getServiceReportWindows,
} from "../read";
import { recordExternalServiceReport } from "../record";

const TEST_PREFIX = "svc-extreport-test";

afterEach(async () => {
  const services = await db
    .select({ id: externalService.id })
    .from(externalService)
    .where(like(externalService.slug, `${TEST_PREFIX}-%`))
    .all();
  const ids = services.map((s) => s.id);
  if (ids.length > 0) {
    await db
      .delete(externalServiceReport)
      .where(inArray(externalServiceReport.externalServiceId, ids))
      .run();
    await db
      .delete(externalServiceComponent)
      .where(inArray(externalServiceComponent.externalServiceId, ids))
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

async function seedComponent(serviceId: number, slug: string) {
  const [row] = await db
    .insert(externalServiceComponent)
    .values({
      externalServiceId: serviceId,
      upstreamComponentId: `upstream-${slug}`,
      slug,
      name: slug,
      indicator: "none",
      status: "operational",
    })
    .returning();
  return row;
}

async function insertReports(
  rows: {
    externalServiceId: number;
    externalServiceComponentId?: number | null;
    reporterHash: string;
    country?: string;
    createdAt: Date;
  }[],
) {
  await db
    .insert(externalServiceReport)
    .values(
      rows.map((r) => ({
        externalServiceId: r.externalServiceId,
        externalServiceComponentId: r.externalServiceComponentId ?? null,
        reporterHash: r.reporterHash,
        country: r.country ?? "",
        createdAt: r.createdAt,
      })),
    )
    .run();
}

describe("recordExternalServiceReport", () => {
  test("inserts a service-level report row", async () => {
    const service = await seedService({ slug: `${TEST_PREFIX}-live` });
    const result = await recordExternalServiceReport({
      input: {
        slug: `${TEST_PREFIX}-live`,
        reporterHash: "hash",
        country: "FR",
      },
    });
    expect(result).toEqual({
      serviceSlug: `${TEST_PREFIX}-live`,
      componentId: null,
    });
    const rows = await db
      .select()
      .from(externalServiceReport)
      .where(eq(externalServiceReport.externalServiceId, service.id))
      .all();
    expect(rows.length).toBe(1);
    expect(rows[0].externalServiceComponentId).toBeNull();
    expect(rows[0].country).toBe("FR");
  });

  test("resolves an alias slug to the canonical service", async () => {
    const service = await seedService({
      slug: `${TEST_PREFIX}-canonical`,
      aliases: [`${TEST_PREFIX}-old`],
    });
    const result = await recordExternalServiceReport({
      input: { slug: `${TEST_PREFIX}-old`, reporterHash: "hash", country: "" },
    });
    expect(result.serviceSlug).toBe(`${TEST_PREFIX}-canonical`);
    const rows = await db
      .select()
      .from(externalServiceReport)
      .where(eq(externalServiceReport.externalServiceId, service.id))
      .all();
    expect(rows.length).toBe(1);
  });

  test("throws for an unknown service", async () => {
    await expect(
      recordExternalServiceReport({
        input: {
          slug: `${TEST_PREFIX}-missing`,
          reporterHash: "hash",
          country: "",
        },
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  test("throws for a soft-deleted service", async () => {
    await seedService({ slug: `${TEST_PREFIX}-gone`, deletedAt: new Date() });
    await expect(
      recordExternalServiceReport({
        input: {
          slug: `${TEST_PREFIX}-gone`,
          reporterHash: "hash",
          country: "",
        },
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  test("inserts a component-level report keyed by the component id", async () => {
    const service = await seedService({ slug: `${TEST_PREFIX}-withcomp` });
    const component = await seedComponent(service.id, "api");
    const result = await recordExternalServiceReport({
      input: {
        slug: `${TEST_PREFIX}-withcomp`,
        componentSlug: "api",
        reporterHash: "hash",
        country: "DE",
      },
    });
    expect(result.componentId).toBe(component.id);
    const rows = await db
      .select()
      .from(externalServiceReport)
      .where(eq(externalServiceReport.externalServiceId, service.id))
      .all();
    expect(rows[0].externalServiceComponentId).toBe(component.id);
  });

  test("throws for an unknown component", async () => {
    await seedService({ slug: `${TEST_PREFIX}-nocomp` });
    await expect(
      recordExternalServiceReport({
        input: {
          slug: `${TEST_PREFIX}-nocomp`,
          componentSlug: "does-not-exist",
          reporterHash: "hash",
          country: "",
        },
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("report aggregation reads", () => {
  test("getServiceReportWindows counts distinct reporters + countries", async () => {
    const service = await seedService({ slug: `${TEST_PREFIX}-agg` });
    const now = new Date();
    await insertReports([
      {
        externalServiceId: service.id,
        reporterHash: "a",
        country: "US",
        createdAt: now,
      },
      {
        externalServiceId: service.id,
        reporterHash: "a",
        country: "US",
        createdAt: now,
      },
      {
        externalServiceId: service.id,
        reporterHash: "b",
        country: "FR",
        createdAt: now,
      },
      {
        externalServiceId: service.id,
        reporterHash: "c",
        country: "",
        createdAt: now,
      },
    ]);
    const [row] = await getServiceReportWindows({
      serviceIds: [service.id],
      since: new Date(now.getTime() - 60_000),
    });
    expect(row.reporters).toBe(3);
    expect(row.total).toBe(4);
    expect(row.countries).toBe(2);
  });

  test("getServiceReportWindows excludes rows before `since`", async () => {
    const service = await seedService({ slug: `${TEST_PREFIX}-window` });
    const now = new Date();
    await insertReports([
      { externalServiceId: service.id, reporterHash: "a", createdAt: now },
      {
        externalServiceId: service.id,
        reporterHash: "b",
        createdAt: new Date(now.getTime() - 60 * 60 * 1000),
      },
    ]);
    const [row] = await getServiceReportWindows({
      serviceIds: [service.id],
      since: new Date(now.getTime() - 15 * 60 * 1000),
    });
    expect(row.reporters).toBe(1);
  });

  test("getComponentReportWindows groups by component, ignoring service-level", async () => {
    const service = await seedService({ slug: `${TEST_PREFIX}-comp` });
    const api = await seedComponent(service.id, "api");
    const web = await seedComponent(service.id, "web");
    const now = new Date();
    await insertReports([
      {
        externalServiceId: service.id,
        externalServiceComponentId: api.id,
        reporterHash: "a",
        createdAt: now,
      },
      {
        externalServiceId: service.id,
        externalServiceComponentId: api.id,
        reporterHash: "b",
        createdAt: now,
      },
      {
        externalServiceId: service.id,
        externalServiceComponentId: web.id,
        reporterHash: "a",
        createdAt: now,
      },
      {
        externalServiceId: service.id,
        externalServiceComponentId: null,
        reporterHash: "z",
        createdAt: now,
      },
    ]);
    const rows = await getComponentReportWindows({
      serviceId: service.id,
      since: new Date(now.getTime() - 60_000),
    });
    const byComponent = new Map(rows.map((r) => [r.componentId, r.reporters]));
    expect(byComponent.get(api.id)).toBe(2);
    expect(byComponent.get(web.id)).toBe(1);
    expect(rows.length).toBe(2);
  });

  test("getServiceReportDaily buckets by day", async () => {
    const service = await seedService({ slug: `${TEST_PREFIX}-daily` });
    await insertReports([
      {
        externalServiceId: service.id,
        reporterHash: "a",
        createdAt: new Date("2026-06-01T10:00:00Z"),
      },
      {
        externalServiceId: service.id,
        reporterHash: "b",
        createdAt: new Date("2026-06-01T12:00:00Z"),
      },
      {
        externalServiceId: service.id,
        reporterHash: "c",
        createdAt: new Date("2026-06-02T09:00:00Z"),
      },
    ]);
    const rows = await getServiceReportDaily({
      serviceId: service.id,
      since: new Date("2026-05-01T00:00:00Z"),
    });
    expect(rows).toEqual([
      { day: "2026-06-01", reporters: 2, total: 2 },
      { day: "2026-06-02", reporters: 1, total: 1 },
    ]);
  });

  test("getServiceReportCountries ranks non-empty countries", async () => {
    const service = await seedService({ slug: `${TEST_PREFIX}-countries` });
    const now = new Date();
    await insertReports([
      {
        externalServiceId: service.id,
        reporterHash: "a",
        country: "US",
        createdAt: now,
      },
      {
        externalServiceId: service.id,
        reporterHash: "b",
        country: "US",
        createdAt: now,
      },
      {
        externalServiceId: service.id,
        reporterHash: "c",
        country: "FR",
        createdAt: now,
      },
      {
        externalServiceId: service.id,
        reporterHash: "d",
        country: "",
        createdAt: now,
      },
    ]);
    const rows = await getServiceReportCountries({
      serviceId: service.id,
      since: new Date(now.getTime() - 60_000),
      limit: 5,
    });
    expect(rows).toEqual([
      { country: "US", total: 2 },
      { country: "FR", total: 1 },
    ]);
  });
});
