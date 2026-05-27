import { afterEach, describe, expect, test } from "bun:test";
import { and, db, eq, like } from "@openstatus/db";
import {
  externalService,
  externalServiceIncident,
} from "@openstatus/db/src/schema";

import {
  listExternalIncidentsBySlug,
  pruneStaleRawPayloads,
  upsertExternalIncidentsForService,
} from "../index";

const TEST_PREFIX = "svc-extincident-test";

afterEach(async () => {
  const ids = await db
    .select({ id: externalService.id })
    .from(externalService)
    .where(like(externalService.slug, `${TEST_PREFIX}-%`))
    .all();
  for (const { id } of ids) {
    await db
      .delete(externalServiceIncident)
      .where(eq(externalServiceIncident.externalServiceId, id))
      .run();
  }
  await db
    .delete(externalService)
    .where(like(externalService.slug, `${TEST_PREFIX}-%`))
    .run();
});

async function seedService(opts: {
  slug: string;
  aliases?: string[];
}): Promise<number> {
  const { slug, aliases = [] } = opts;
  const rows = await db
    .insert(externalService)
    .values({
      slug,
      aliases,
      name: `Test ${slug}`,
      url: "https://example.com",
      statusPageUrl: "https://status.example.com",
      provider: "atlassian-statuspage",
      industry: ["saas"],
      apiConfig: { type: "atlassian" },
    })
    .returning({ id: externalService.id })
    .all();
  const id = rows[0]?.id;
  if (!id) throw new Error("failed to seed external_service");
  return id;
}

describe("upsertExternalIncidentsForService", () => {
  test("inserts incidents and is idempotent on second call (update path)", async () => {
    const serviceId = await seedService({ slug: `${TEST_PREFIX}-upsert` });
    const baseDate = new Date("2024-06-01T12:00:00.000Z");

    const first = await upsertExternalIncidentsForService({
      externalServiceId: serviceId,
      now: baseDate,
      incidents: [
        {
          providerIncidentId: "abc",
          name: "Initial outage",
          status: "investigating",
          impact: "major",
          shortlink: "https://stspg.io/abc",
          startedAt: new Date("2024-06-01T11:55:00.000Z"),
          createdAt: new Date("2024-06-01T11:56:00.000Z"),
          resolvedAt: null,
          raw: { id: "abc", body: "initial" },
        },
      ],
    });
    expect(first.upserted).toBe(1);

    const inserted = await db
      .select()
      .from(externalServiceIncident)
      .where(
        and(
          eq(externalServiceIncident.externalServiceId, serviceId),
          eq(externalServiceIncident.providerIncidentId, "abc"),
        ),
      )
      .all();
    expect(inserted).toHaveLength(1);
    expect(inserted[0]?.status).toBe("investigating");
    expect(inserted[0]?.resolvedAt).toBeNull();
    expect(inserted[0]?.firstSeenAt.getTime()).toBe(baseDate.getTime());

    const laterDate = new Date("2024-06-01T13:00:00.000Z");
    const second = await upsertExternalIncidentsForService({
      externalServiceId: serviceId,
      now: laterDate,
      incidents: [
        {
          providerIncidentId: "abc",
          name: "Initial outage",
          status: "resolved",
          impact: "major",
          shortlink: "https://stspg.io/abc",
          startedAt: new Date("2024-06-01T11:55:00.000Z"),
          createdAt: new Date("2024-06-01T11:56:00.000Z"),
          resolvedAt: new Date("2024-06-01T12:45:00.000Z"),
          raw: { id: "abc", body: "resolved" },
        },
      ],
    });
    expect(second.upserted).toBe(1);

    const updated = await db
      .select()
      .from(externalServiceIncident)
      .where(
        and(
          eq(externalServiceIncident.externalServiceId, serviceId),
          eq(externalServiceIncident.providerIncidentId, "abc"),
        ),
      )
      .all();
    expect(updated).toHaveLength(1);
    expect(updated[0]?.status).toBe("resolved");
    expect(updated[0]?.resolvedAt).toBeInstanceOf(Date);
    expect(updated[0]?.firstSeenAt.getTime()).toBe(baseDate.getTime());
    expect(updated[0]?.lastSeenAt.getTime()).toBe(laterDate.getTime());
  });

  test("backfills startedAt when upstream populates it after first sight", async () => {
    const serviceId = await seedService({ slug: `${TEST_PREFIX}-backfill` });

    await upsertExternalIncidentsForService({
      externalServiceId: serviceId,
      incidents: [
        {
          providerIncidentId: "late-start",
          name: "triaging",
          status: "investigating",
          createdAt: new Date("2024-07-01T00:00:00.000Z"),
          startedAt: undefined,
          resolvedAt: null,
          raw: {},
        },
      ],
    });

    const populatedStartedAt = new Date("2024-07-01T00:05:00.000Z");
    await upsertExternalIncidentsForService({
      externalServiceId: serviceId,
      incidents: [
        {
          providerIncidentId: "late-start",
          name: "triaging",
          status: "identified",
          createdAt: new Date("2024-07-01T00:00:00.000Z"),
          startedAt: populatedStartedAt,
          resolvedAt: null,
          raw: {},
        },
      ],
    });

    const rows = await db
      .select()
      .from(externalServiceIncident)
      .where(
        and(
          eq(externalServiceIncident.externalServiceId, serviceId),
          eq(externalServiceIncident.providerIncidentId, "late-start"),
        ),
      )
      .all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.startedAt?.getTime()).toBe(populatedStartedAt.getTime());
  });

  test("no-op when given an empty list", async () => {
    const serviceId = await seedService({ slug: `${TEST_PREFIX}-empty` });
    const res = await upsertExternalIncidentsForService({
      externalServiceId: serviceId,
      incidents: [],
    });
    expect(res.upserted).toBe(0);
  });
});

describe("listExternalIncidentsBySlug", () => {
  test("orders by started_at desc and respects limit", async () => {
    const serviceId = await seedService({ slug: `${TEST_PREFIX}-list` });

    await upsertExternalIncidentsForService({
      externalServiceId: serviceId,
      incidents: [
        {
          providerIncidentId: "old",
          name: "Old",
          status: "resolved",
          createdAt: new Date("2024-01-01T00:00:00.000Z"),
          startedAt: new Date("2024-01-01T00:00:00.000Z"),
          resolvedAt: new Date("2024-01-01T01:00:00.000Z"),
          raw: {},
        },
        {
          providerIncidentId: "new",
          name: "New",
          status: "investigating",
          createdAt: new Date("2024-06-01T00:00:00.000Z"),
          startedAt: new Date("2024-06-01T00:00:00.000Z"),
          resolvedAt: null,
          raw: {},
        },
        {
          providerIncidentId: "mid",
          name: "Mid",
          status: "monitoring",
          createdAt: new Date("2024-03-01T00:00:00.000Z"),
          startedAt: new Date("2024-03-01T00:00:00.000Z"),
          resolvedAt: null,
          raw: {},
        },
      ],
    });

    const { service, incidents } = await listExternalIncidentsBySlug({
      slug: `${TEST_PREFIX}-list`,
      limit: 2,
    });

    expect(service).not.toBeNull();
    expect(incidents).toHaveLength(2);
    expect(incidents[0]?.providerIncidentId).toBe("new");
    expect(incidents[1]?.providerIncidentId).toBe("mid");
  });

  test("resolves alias slug to canonical service", async () => {
    const serviceId = await seedService({
      slug: `${TEST_PREFIX}-canonical`,
      aliases: [`${TEST_PREFIX}-aliased`],
    });

    await upsertExternalIncidentsForService({
      externalServiceId: serviceId,
      incidents: [
        {
          providerIncidentId: "x",
          name: "Hit via alias",
          status: "resolved",
          createdAt: new Date(),
          startedAt: new Date(),
          resolvedAt: new Date(),
          raw: {},
        },
      ],
    });

    const viaAlias = await listExternalIncidentsBySlug({
      slug: `${TEST_PREFIX}-aliased`,
    });
    expect(viaAlias.service?.id).toBe(serviceId);
    expect(viaAlias.incidents).toHaveLength(1);
  });

  test("returns empty for unknown slug", async () => {
    const { service, incidents } = await listExternalIncidentsBySlug({
      slug: `${TEST_PREFIX}-missing`,
    });
    expect(service).toBeNull();
    expect(incidents).toEqual([]);
  });
});

describe("pruneStaleRawPayloads", () => {
  test("nulls raw_payload for resolved incidents past the TTL only", async () => {
    const serviceId = await seedService({ slug: `${TEST_PREFIX}-prune` });
    const now = new Date("2025-01-01T00:00:00.000Z");

    await upsertExternalIncidentsForService({
      externalServiceId: serviceId,
      now: new Date("2024-01-01T00:00:00.000Z"),
      incidents: [
        {
          providerIncidentId: "stale-resolved",
          name: "stale",
          status: "resolved",
          createdAt: new Date("2024-01-01T00:00:00.000Z"),
          startedAt: new Date("2024-01-01T00:00:00.000Z"),
          resolvedAt: new Date("2024-01-02T00:00:00.000Z"),
          raw: { keep: "no" },
        },
        {
          providerIncidentId: "recent-resolved",
          name: "recent",
          status: "resolved",
          createdAt: new Date("2024-12-25T00:00:00.000Z"),
          startedAt: new Date("2024-12-25T00:00:00.000Z"),
          resolvedAt: new Date("2024-12-25T01:00:00.000Z"),
          raw: { keep: "yes" },
        },
        {
          providerIncidentId: "ongoing-old",
          name: "ongoing",
          status: "investigating",
          createdAt: new Date("2024-01-01T00:00:00.000Z"),
          startedAt: new Date("2024-01-01T00:00:00.000Z"),
          resolvedAt: null,
          raw: { keep: "yes-ongoing" },
        },
      ],
    });

    const res = await pruneStaleRawPayloads({
      now,
      olderThanDays: 90,
    });
    expect(res.purged).toBe(1);

    const rows = await db
      .select()
      .from(externalServiceIncident)
      .where(eq(externalServiceIncident.externalServiceId, serviceId))
      .all();

    const byId = new Map(rows.map((r) => [r.providerIncidentId, r]));
    expect(byId.get("stale-resolved")?.rawPayload).toBeNull();
    expect(byId.get("stale-resolved")?.rawPayloadPurgedAt).toBeInstanceOf(Date);
    expect(byId.get("recent-resolved")?.rawPayload).not.toBeNull();
    expect(byId.get("recent-resolved")?.rawPayloadPurgedAt).toBeNull();
    expect(byId.get("ongoing-old")?.rawPayload).not.toBeNull();
    expect(byId.get("ongoing-old")?.rawPayloadPurgedAt).toBeNull();
  });
});
