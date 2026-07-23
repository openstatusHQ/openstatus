import { and, db, eq, like } from "@openstatus/db";
import type { ApiConfigType } from "@openstatus/db/src/schema";
import {
  externalService,
  externalServiceComponent,
} from "@openstatus/db/src/schema";
import { expect } from "@std/expect";
import { afterEach, describe, test } from "@std/testing/bdd";

import {
  getExternalComponentBySlug,
  listExternalComponentsBySlug,
  upsertExternalComponentsForService,
} from "../index";

const TEST_PREFIX = "svc-extcomponent-test";

afterEach(async () => {
  const ids = await db
    .select({ id: externalService.id })
    .from(externalService)
    .where(like(externalService.slug, `${TEST_PREFIX}-%`))
    .all();
  for (const { id } of ids) {
    await db
      .delete(externalServiceComponent)
      .where(eq(externalServiceComponent.externalServiceId, id))
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
  apiConfigType?: ApiConfigType;
}): Promise<number> {
  const { slug, aliases = [], apiConfigType = "atlassian" } = opts;
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
      apiConfig: { type: apiConfigType },
    })
    .returning({ id: externalService.id })
    .all();
  const id = rows[0]?.id;
  if (!id) throw new Error("failed to seed external_service");
  return id;
}

describe("upsertExternalComponentsForService", () => {
  test("inserts components and is idempotent on second call (update path)", async () => {
    const serviceId = await seedService({ slug: `${TEST_PREFIX}-upsert` });
    const baseDate = new Date("2024-06-01T12:00:00.000Z");

    const first = await upsertExternalComponentsForService({
      externalServiceId: serviceId,
      now: baseDate,
      components: [
        {
          upstreamComponentId: "cmp-1",
          name: "fra1",
          groupName: "Regions",
          position: 1,
          indicator: "none",
          status: "operational",
        },
      ],
    });
    expect(first.upserted).toHaveLength(1);
    expect(first.upserted[0]?.upstreamComponentId).toBe("cmp-1");
    expect(first.upserted[0]?.id).toBeGreaterThan(0);

    const inserted = await db
      .select()
      .from(externalServiceComponent)
      .where(
        and(
          eq(externalServiceComponent.externalServiceId, serviceId),
          eq(externalServiceComponent.upstreamComponentId, "cmp-1"),
        ),
      )
      .all();
    expect(inserted).toHaveLength(1);
    expect(inserted[0]?.status).toBe("operational");
    expect(inserted[0]?.firstSeenAt.getTime()).toBe(baseDate.getTime());

    const laterDate = new Date("2024-06-01T13:00:00.000Z");
    const second = await upsertExternalComponentsForService({
      externalServiceId: serviceId,
      now: laterDate,
      components: [
        {
          upstreamComponentId: "cmp-1",
          name: "fra1",
          groupName: "Regions",
          position: 1,
          indicator: "major",
          status: "partial_outage",
        },
      ],
    });
    expect(second.upserted).toHaveLength(1);

    const updated = await db
      .select()
      .from(externalServiceComponent)
      .where(
        and(
          eq(externalServiceComponent.externalServiceId, serviceId),
          eq(externalServiceComponent.upstreamComponentId, "cmp-1"),
        ),
      )
      .all();
    expect(updated).toHaveLength(1);
    expect(updated[0]?.status).toBe("partial_outage");
    expect(updated[0]?.indicator).toBe("major");
    expect(updated[0]?.firstSeenAt.getTime()).toBe(baseDate.getTime());
    expect(updated[0]?.updatedAt.getTime()).toBe(laterDate.getTime());
  });

  test("idle re-upsert with identical input leaves updatedAt unchanged", async () => {
    const serviceId = await seedService({ slug: `${TEST_PREFIX}-idle` });
    const baseDate = new Date("2024-06-01T12:00:00.000Z");
    const input = {
      upstreamComponentId: "cmp-idle",
      name: "Idle component",
      groupName: "Regions",
      position: 0,
      indicator: "none",
      status: "operational",
    } as const;

    await upsertExternalComponentsForService({
      externalServiceId: serviceId,
      now: baseDate,
      components: [input],
    });

    const before = await db
      .select()
      .from(externalServiceComponent)
      .where(
        and(
          eq(externalServiceComponent.externalServiceId, serviceId),
          eq(externalServiceComponent.upstreamComponentId, "cmp-idle"),
        ),
      )
      .all();

    await upsertExternalComponentsForService({
      externalServiceId: serviceId,
      now: new Date("2024-06-01T13:00:00.000Z"),
      components: [input],
    });

    const after = await db
      .select()
      .from(externalServiceComponent)
      .where(
        and(
          eq(externalServiceComponent.externalServiceId, serviceId),
          eq(externalServiceComponent.upstreamComponentId, "cmp-idle"),
        ),
      )
      .all();
    expect(after[0]?.updatedAt.getTime()).toBe(
      before[0]?.updatedAt.getTime() ?? -1,
    );
  });

  test("real change bumps updatedAt only on the changed row", async () => {
    const serviceId = await seedService({ slug: `${TEST_PREFIX}-changed` });
    const baseDate = new Date("2024-06-01T12:00:00.000Z");

    await upsertExternalComponentsForService({
      externalServiceId: serviceId,
      now: baseDate,
      components: [
        {
          upstreamComponentId: "cmp-a",
          name: "A",
          position: 0,
          indicator: "none",
          status: "operational",
        },
        {
          upstreamComponentId: "cmp-b",
          name: "B",
          position: 1,
          indicator: "none",
          status: "operational",
        },
      ],
    });

    const before = await db
      .select()
      .from(externalServiceComponent)
      .where(eq(externalServiceComponent.externalServiceId, serviceId))
      .all();
    const beforeByKey = new Map(
      before.map((r) => [r.upstreamComponentId, r.updatedAt.getTime()]),
    );

    const laterDate = new Date("2024-06-01T13:00:00.000Z");
    await upsertExternalComponentsForService({
      externalServiceId: serviceId,
      now: laterDate,
      components: [
        {
          upstreamComponentId: "cmp-a",
          name: "A",
          position: 0,
          indicator: "major",
          status: "partial_outage",
        },
        {
          upstreamComponentId: "cmp-b",
          name: "B",
          position: 1,
          indicator: "none",
          status: "operational",
        },
      ],
    });

    const after = await db
      .select()
      .from(externalServiceComponent)
      .where(eq(externalServiceComponent.externalServiceId, serviceId))
      .all();
    const afterByKey = new Map(
      after.map((r) => [r.upstreamComponentId, r.updatedAt.getTime()]),
    );

    expect(afterByKey.get("cmp-a")).toBe(laterDate.getTime());
    expect(afterByKey.get("cmp-b")).toBe(beforeByKey.get("cmp-b"));
  });

  test("new component is inserted with firstSeenAt = now", async () => {
    const serviceId = await seedService({ slug: `${TEST_PREFIX}-new` });

    await upsertExternalComponentsForService({
      externalServiceId: serviceId,
      now: new Date("2024-06-01T12:00:00.000Z"),
      components: [
        {
          upstreamComponentId: "existing",
          name: "existing",
          position: 0,
          indicator: "none",
          status: "operational",
        },
      ],
    });

    const newNow = new Date("2024-06-01T13:00:00.000Z");
    await upsertExternalComponentsForService({
      externalServiceId: serviceId,
      now: newNow,
      components: [
        {
          upstreamComponentId: "existing",
          name: "existing",
          position: 0,
          indicator: "none",
          status: "operational",
        },
        {
          upstreamComponentId: "fresh",
          name: "fresh",
          position: 1,
          indicator: "none",
          status: "operational",
        },
      ],
    });

    const rows = await db
      .select()
      .from(externalServiceComponent)
      .where(
        and(
          eq(externalServiceComponent.externalServiceId, serviceId),
          eq(externalServiceComponent.upstreamComponentId, "fresh"),
        ),
      )
      .all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.firstSeenAt.getTime()).toBe(newNow.getTime());
  });

  test("no-op when given an empty list", async () => {
    const serviceId = await seedService({ slug: `${TEST_PREFIX}-empty` });
    const res = await upsertExternalComponentsForService({
      externalServiceId: serviceId,
      components: [],
    });
    expect(res.upserted).toEqual([]);
  });
});

describe("listExternalComponentsBySlug", () => {
  test("returns components ordered by position and supported=true", async () => {
    const serviceId = await seedService({ slug: `${TEST_PREFIX}-list` });

    await upsertExternalComponentsForService({
      externalServiceId: serviceId,
      components: [
        {
          upstreamComponentId: "b",
          name: "second",
          position: 2,
          indicator: "none",
          status: "operational",
        },
        {
          upstreamComponentId: "a",
          name: "first",
          position: 1,
          indicator: "none",
          status: "operational",
        },
      ],
    });

    const { service, supported, components } =
      await listExternalComponentsBySlug({ slug: `${TEST_PREFIX}-list` });
    expect(service).not.toBeNull();
    expect(supported).toBe(true);
    expect(components).toHaveLength(2);
    expect(components[0]?.upstreamComponentId).toBe("a");
    expect(components[1]?.upstreamComponentId).toBe("b");
  });

  test("resolves alias slug to canonical service", async () => {
    const serviceId = await seedService({
      slug: `${TEST_PREFIX}-canonical`,
      aliases: [`${TEST_PREFIX}-aliased`],
    });

    await upsertExternalComponentsForService({
      externalServiceId: serviceId,
      components: [
        {
          upstreamComponentId: "x",
          name: "via-alias",
          position: 0,
          indicator: "none",
          status: "operational",
        },
      ],
    });

    const viaAlias = await listExternalComponentsBySlug({
      slug: `${TEST_PREFIX}-aliased`,
    });
    expect(viaAlias.service?.id).toBe(serviceId);
    expect(viaAlias.components).toHaveLength(1);
  });

  test("returns supported=false for a provider without component support", async () => {
    await seedService({
      slug: `${TEST_PREFIX}-custom`,
      apiConfigType: "custom",
    });
    const { supported, components } = await listExternalComponentsBySlug({
      slug: `${TEST_PREFIX}-custom`,
    });
    expect(supported).toBe(false);
    expect(components).toEqual([]);
  });

  test("returns null service for unknown slug", async () => {
    const { service, components } = await listExternalComponentsBySlug({
      slug: `${TEST_PREFIX}-missing`,
    });
    expect(service).toBeNull();
    expect(components).toEqual([]);
  });
});

describe("getExternalComponentBySlug", () => {
  test("resolves by current slug and by past alias after a rename", async () => {
    const serviceSlug = `${TEST_PREFIX}-getcomp`;
    const serviceId = await seedService({ slug: serviceSlug });

    await upsertExternalComponentsForService({
      externalServiceId: serviceId,
      now: new Date("2024-06-01T00:00:00.000Z"),
      components: [
        {
          upstreamComponentId: "r1",
          name: "Frankfurt",
          position: 0,
          indicator: "none",
          status: "operational",
        },
      ],
    });

    const byOriginal = await getExternalComponentBySlug({
      serviceSlug,
      componentSlug: "frankfurt",
      now: new Date("2024-06-01T00:05:00.000Z"),
    });
    expect(byOriginal.component?.slug).toBe("frankfurt");

    // rename → slug becomes eu-central, "frankfurt" preserved as alias
    await upsertExternalComponentsForService({
      externalServiceId: serviceId,
      now: new Date("2024-06-01T00:10:00.000Z"),
      components: [
        {
          upstreamComponentId: "r1",
          name: "EU Central",
          position: 0,
          indicator: "none",
          status: "operational",
        },
      ],
    });

    const byCurrent = await getExternalComponentBySlug({
      serviceSlug,
      componentSlug: "eu-central",
    });
    expect(byCurrent.component?.slug).toBe("eu-central");

    const byAlias = await getExternalComponentBySlug({
      serviceSlug,
      componentSlug: "frankfurt",
    });
    expect(byAlias.component?.slug).toBe("eu-central");
  });

  test("returns null component for an unknown component slug", async () => {
    const serviceSlug = `${TEST_PREFIX}-getmissing`;
    await seedService({ slug: serviceSlug });
    const res = await getExternalComponentBySlug({
      serviceSlug,
      componentSlug: "nope",
    });
    expect(res.service).not.toBeNull();
    expect(res.component).toBeNull();
  });
});
