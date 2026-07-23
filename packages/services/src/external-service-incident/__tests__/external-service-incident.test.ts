import { and, db, eq, like } from "@openstatus/db";
import {
  externalService,
  externalServiceIncident,
} from "@openstatus/db/src/schema";
import { expect } from "@std/expect";
import { afterEach, describe, test } from "@std/testing/bdd";

import {
  type UpsertExternalIncidentInput,
  listExternalIncidentsByComponent,
  listExternalIncidentsByServiceId,
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
    expect(updated[0]?.updatedAt.getTime()).toBe(laterDate.getTime());
  });

  test("idle re-upsert with identical input leaves updatedAt unchanged", async () => {
    const serviceId = await seedService({ slug: `${TEST_PREFIX}-idle` });
    const baseDate = new Date("2024-06-01T12:00:00.000Z");
    const incident: UpsertExternalIncidentInput = {
      providerIncidentId: "idle-1",
      name: "Idle outage",
      status: "investigating",
      impact: "minor",
      shortlink: "https://stspg.io/idle",
      startedAt: new Date("2024-06-01T11:55:00.000Z"),
      createdAt: new Date("2024-06-01T11:56:00.000Z"),
      resolvedAt: null,
      affectedComponentIds: ["cmp-a", "cmp-b"],
      raw: { id: "idle-1" },
    };

    await upsertExternalIncidentsForService({
      externalServiceId: serviceId,
      now: baseDate,
      incidents: [incident],
    });

    const before = await db
      .select()
      .from(externalServiceIncident)
      .where(
        and(
          eq(externalServiceIncident.externalServiceId, serviceId),
          eq(externalServiceIncident.providerIncidentId, "idle-1"),
        ),
      )
      .all();

    const laterDate = new Date("2024-06-01T13:00:00.000Z");
    const result = await upsertExternalIncidentsForService({
      externalServiceId: serviceId,
      now: laterDate,
      incidents: [incident],
    });
    expect(result.upserted).toBe(0);

    const after = await db
      .select()
      .from(externalServiceIncident)
      .where(
        and(
          eq(externalServiceIncident.externalServiceId, serviceId),
          eq(externalServiceIncident.providerIncidentId, "idle-1"),
        ),
      )
      .all();
    expect(after[0]?.updatedAt.getTime()).toBe(
      before[0]?.updatedAt.getTime() ?? -1,
    );
  });

  test("idle re-upsert ignores sub-second precision lost on storage round-trip", async () => {
    const serviceId = await seedService({ slug: `${TEST_PREFIX}-subsec` });
    const baseDate = new Date("2024-06-01T12:00:00.000Z");
    const incident: UpsertExternalIncidentInput = {
      providerIncidentId: "subsec-1",
      name: "Sub-second outage",
      status: "resolved",
      impact: "critical",
      shortlink: "https://stspg.io/subsec",
      startedAt: new Date("2024-06-01T11:55:00.569Z"),
      createdAt: new Date("2024-06-01T11:56:00.123Z"),
      resolvedAt: new Date("2024-06-01T12:30:00.611Z"),
      affectedComponentIds: ["cmp-a"],
      raw: { id: "subsec-1" },
    };

    await upsertExternalIncidentsForService({
      externalServiceId: serviceId,
      now: baseDate,
      incidents: [incident],
    });

    const before = await db
      .select()
      .from(externalServiceIncident)
      .where(
        and(
          eq(externalServiceIncident.externalServiceId, serviceId),
          eq(externalServiceIncident.providerIncidentId, "subsec-1"),
        ),
      )
      .all();

    const laterDate = new Date("2024-06-01T13:00:00.000Z");
    const result = await upsertExternalIncidentsForService({
      externalServiceId: serviceId,
      now: laterDate,
      incidents: [incident],
    });
    expect(result.upserted).toBe(0);

    const after = await db
      .select()
      .from(externalServiceIncident)
      .where(
        and(
          eq(externalServiceIncident.externalServiceId, serviceId),
          eq(externalServiceIncident.providerIncidentId, "subsec-1"),
        ),
      )
      .all();
    expect(after[0]?.updatedAt.getTime()).toBe(
      before[0]?.updatedAt.getTime() ?? -1,
    );
  });

  test("rawPayload co-rewrites when a scalar field changes", async () => {
    const serviceId = await seedService({ slug: `${TEST_PREFIX}-corew` });
    const baseDate = new Date("2024-06-01T12:00:00.000Z");

    await upsertExternalIncidentsForService({
      externalServiceId: serviceId,
      now: baseDate,
      incidents: [
        {
          providerIncidentId: "co-1",
          name: "Co-rewrite",
          status: "investigating",
          createdAt: new Date("2024-06-01T11:56:00.000Z"),
          resolvedAt: null,
          raw: { rev: 1 },
        },
      ],
    });

    await upsertExternalIncidentsForService({
      externalServiceId: serviceId,
      now: new Date("2024-06-01T13:00:00.000Z"),
      incidents: [
        {
          providerIncidentId: "co-1",
          name: "Co-rewrite",
          status: "resolved",
          createdAt: new Date("2024-06-01T11:56:00.000Z"),
          resolvedAt: new Date("2024-06-01T12:45:00.000Z"),
          raw: { rev: 2 },
        },
      ],
    });

    const rows = await db
      .select()
      .from(externalServiceIncident)
      .where(
        and(
          eq(externalServiceIncident.externalServiceId, serviceId),
          eq(externalServiceIncident.providerIncidentId, "co-1"),
        ),
      )
      .all();
    expect(rows[0]?.rawPayload).toEqual({ rev: 2 });
  });

  test("rawPayload unchanged on no-op even if supplied raw differs", async () => {
    const serviceId = await seedService({ slug: `${TEST_PREFIX}-noop` });
    const baseDate = new Date("2024-06-01T12:00:00.000Z");

    await upsertExternalIncidentsForService({
      externalServiceId: serviceId,
      now: baseDate,
      incidents: [
        {
          providerIncidentId: "noop-1",
          name: "No-op",
          status: "investigating",
          createdAt: new Date("2024-06-01T11:56:00.000Z"),
          resolvedAt: null,
          raw: { rev: "first" },
        },
      ],
    });

    await upsertExternalIncidentsForService({
      externalServiceId: serviceId,
      now: new Date("2024-06-01T13:00:00.000Z"),
      incidents: [
        {
          providerIncidentId: "noop-1",
          name: "No-op",
          status: "investigating",
          createdAt: new Date("2024-06-01T11:56:00.000Z"),
          resolvedAt: null,
          raw: { rev: "second" },
        },
      ],
    });

    const rows = await db
      .select()
      .from(externalServiceIncident)
      .where(
        and(
          eq(externalServiceIncident.externalServiceId, serviceId),
          eq(externalServiceIncident.providerIncidentId, "noop-1"),
        ),
      )
      .all();
    expect(rows[0]?.rawPayload).toEqual({ rev: "first" });
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

describe("listExternalIncidentsByComponent", () => {
  test("returns only incidents tagged with the upstream component id", async () => {
    const serviceId = await seedService({ slug: `${TEST_PREFIX}-bycomp` });

    await upsertExternalIncidentsForService({
      externalServiceId: serviceId,
      incidents: [
        {
          providerIncidentId: "i-fra",
          name: "Frankfurt outage",
          status: "resolved",
          createdAt: new Date("2024-06-01T00:00:00.000Z"),
          startedAt: new Date("2024-06-01T00:00:00.000Z"),
          resolvedAt: new Date("2024-06-01T01:00:00.000Z"),
          affectedComponentIds: ["cmp-fra", "cmp-shared"],
          raw: {},
        },
        {
          providerIncidentId: "i-other",
          name: "Stockholm only",
          status: "resolved",
          createdAt: new Date("2024-06-02T00:00:00.000Z"),
          startedAt: new Date("2024-06-02T00:00:00.000Z"),
          resolvedAt: new Date("2024-06-02T01:00:00.000Z"),
          affectedComponentIds: ["cmp-arn"],
          raw: {},
        },
      ],
    });

    const fra = await listExternalIncidentsByComponent({
      externalServiceId: serviceId,
      upstreamComponentId: "cmp-fra",
    });
    expect(fra).toHaveLength(1);
    expect(fra[0]?.providerIncidentId).toBe("i-fra");

    const shared = await listExternalIncidentsByComponent({
      externalServiceId: serviceId,
      upstreamComponentId: "cmp-shared",
    });
    expect(shared).toHaveLength(1);

    const none = await listExternalIncidentsByComponent({
      externalServiceId: serviceId,
      upstreamComponentId: "cmp-unknown",
    });
    expect(none).toHaveLength(0);
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

describe("listExternalIncidentsByServiceId since-window", () => {
  test("keeps ongoing and resolved-in-window, drops resolved-before", async () => {
    const serviceId = await seedService({ slug: `${TEST_PREFIX}-since` });
    const now = new Date("2026-06-15T00:00:00.000Z");
    const since = new Date("2026-06-01T00:00:00.000Z");

    await upsertExternalIncidentsForService({
      externalServiceId: serviceId,
      now,
      incidents: [
        {
          providerIncidentId: "ongoing-old",
          name: "Ongoing since May",
          status: "investigating",
          impact: "major",
          shortlink: "https://stspg.io/ongoing",
          startedAt: new Date("2026-05-01T00:00:00.000Z"),
          createdAt: new Date("2026-05-01T00:00:00.000Z"),
          resolvedAt: null,
          affectedComponentIds: ["cmp-a"],
          raw: { id: "ongoing-old" },
        },
        {
          providerIncidentId: "resolved-before",
          name: "Resolved before window",
          status: "resolved",
          impact: "minor",
          startedAt: new Date("2026-05-01T00:00:00.000Z"),
          createdAt: new Date("2026-05-01T00:00:00.000Z"),
          resolvedAt: new Date("2026-05-20T00:00:00.000Z"),
          affectedComponentIds: [],
          raw: { id: "resolved-before" },
        },
        {
          providerIncidentId: "resolved-after",
          name: "Resolved inside window",
          status: "resolved",
          impact: "critical",
          startedAt: new Date("2026-05-25T00:00:00.000Z"),
          createdAt: new Date("2026-05-25T00:00:00.000Z"),
          resolvedAt: new Date("2026-06-10T00:00:00.000Z"),
          affectedComponentIds: ["cmp-b"],
          raw: { id: "resolved-after" },
        },
      ],
    });

    const windowed = await listExternalIncidentsByServiceId({
      externalServiceId: serviceId,
      since,
    });
    const ids = new Set(windowed.map((r) => r.providerIncidentId));
    expect(ids.has("ongoing-old")).toBe(true);
    expect(ids.has("resolved-after")).toBe(true);
    expect(ids.has("resolved-before")).toBe(false);

    // affectedComponentIds is returned for server-side per-component bucketing
    const ongoing = windowed.find(
      (r) => r.providerIncidentId === "ongoing-old",
    );
    expect(ongoing?.affectedComponentIds).toEqual(["cmp-a"]);

    // no `since` returns everything (within the default limit)
    const all = await listExternalIncidentsByServiceId({
      externalServiceId: serviceId,
    });
    expect(all.length).toBe(3);
  });
});
