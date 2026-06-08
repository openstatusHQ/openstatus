import { afterEach, describe, expect, test } from "bun:test";
import { db, eq, like } from "@openstatus/db";
import {
  externalService,
  externalServiceComponent,
} from "@openstatus/db/src/schema";
import { OSTinybird } from "@openstatus/tinybird";

import { edgeRouter } from "../edge";
import { createInnerTRPCContext } from "../trpc";

const TEST_PREFIX = "router-extservice-test";

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

async function seedServiceWithComponents(opts: {
  slug: string;
  components: Array<{ upstreamId: string; name: string; position: number }>;
}): Promise<{ serviceId: number; componentIds: number[] }> {
  const rows = await db
    .insert(externalService)
    .values({
      slug: opts.slug,
      aliases: [],
      name: `Test ${opts.slug}`,
      url: "https://example.com",
      statusPageUrl: "https://status.example.com",
      provider: "atlassian-statuspage",
      industry: ["saas"],
      apiConfig: { type: "atlassian" },
    })
    .returning({ id: externalService.id })
    .all();
  const serviceId = rows[0]?.id;
  if (!serviceId) throw new Error("failed to seed external_service");

  const inserted = await db
    .insert(externalServiceComponent)
    .values(
      opts.components.map((c) => ({
        externalServiceId: serviceId,
        upstreamComponentId: c.upstreamId,
        slug: c.upstreamId,
        aliases: [],
        name: c.name,
        position: c.position,
        indicator: "none",
        status: "operational",
      })),
    )
    .returning({ id: externalServiceComponent.id })
    .all();
  return { serviceId, componentIds: inserted.map((r) => r.id) };
}

type LatestStubMode =
  | { kind: "fresh"; nowMs: number }
  | { kind: "byId"; byId: Map<string, number> }
  | { kind: "empty" }
  | { kind: "error" };

type LatestFn = OSTinybird["externalStatusComponentLatest"];
type LatestRow = Awaited<ReturnType<LatestFn>>["data"][number];

// Subclasses the real `OSTinybird` (passing an empty token, which the class
// itself routes to a NoopTinybird internally — all unrelated pipes return empty
// data) and overrides only the methods these tests need. Avoids any/unknown.
class StubTinybird extends OSTinybird {
  private readonly latestFn: LatestFn;

  constructor(mode: LatestStubMode) {
    super("");
    this.latestFn = async ({ component_ids }) => {
      if (mode.kind === "error") {
        throw new Error("simulated TB outage");
      }
      const data: LatestRow[] = [];
      for (const id of component_ids) {
        if (mode.kind === "empty") continue;
        const fetchedAt =
          mode.kind === "fresh" ? mode.nowMs : mode.byId.get(id);
        if (fetchedAt === undefined) continue;
        data.push({
          component_id: id,
          indicator: "none",
          status: "operational",
          last_fetched_at: fetchedAt,
        });
      }
      return { meta: [], data };
    };
  }

  public override get externalStatusComponentLatest(): LatestFn {
    return this.latestFn;
  }
}

function makeCtx(mode: LatestStubMode) {
  return createInnerTRPCContext({
    req: undefined,
    session: null,
    tb: new StubTinybird(mode),
  });
}

describe("externalService.components staleness filter", () => {
  test("includes only components whose TB last_fetched_at is within the 24h cutoff", async () => {
    const { componentIds } = await seedServiceWithComponents({
      slug: `${TEST_PREFIX}-stale`,
      components: [
        { upstreamId: "fresh", name: "Fresh", position: 0 },
        { upstreamId: "stale", name: "Stale", position: 1 },
      ],
    });

    const now = Date.now();
    const byId = new Map<string, number>();
    const freshId = componentIds[0];
    const staleId = componentIds[1];
    if (freshId === undefined || staleId === undefined) {
      throw new Error("seed failure: missing component ids");
    }
    byId.set(String(freshId), now - 60_000);
    byId.set(String(staleId), now - 48 * 60 * 60 * 1000);

    const ctx = makeCtx({ kind: "byId", byId });
    const caller = edgeRouter.createCaller(ctx);
    const { supported, components } = await caller.externalService.components({
      slug: `${TEST_PREFIX}-stale`,
    });

    expect(supported).toBe(true);
    expect(components).toHaveLength(1);
    expect(components[0]?.slug).toBe("fresh");
  });

  test("TB throwing causes the router to render every component (degrade-safe)", async () => {
    await seedServiceWithComponents({
      slug: `${TEST_PREFIX}-tberror`,
      components: [
        { upstreamId: "a", name: "A", position: 0 },
        { upstreamId: "b", name: "B", position: 1 },
      ],
    });

    const ctx = makeCtx({ kind: "error" });
    const caller = edgeRouter.createCaller(ctx);
    const { supported, components } = await caller.externalService.components({
      slug: `${TEST_PREFIX}-tberror`,
    });

    expect(supported).toBe(true);
    expect(components).toHaveLength(2);
  });

  test("TB returning empty filters everything out when the pipe is healthy", async () => {
    await seedServiceWithComponents({
      slug: `${TEST_PREFIX}-tbempty`,
      components: [
        { upstreamId: "a", name: "A", position: 0 },
        { upstreamId: "b", name: "B", position: 1 },
      ],
    });

    const ctx = makeCtx({ kind: "empty" });
    const caller = edgeRouter.createCaller(ctx);
    const { supported, components } = await caller.externalService.components({
      slug: `${TEST_PREFIX}-tbempty`,
    });

    expect(supported).toBe(true);
    expect(components).toHaveLength(0);
  });
});

describe("externalService.component DTO maps lastFetchedAt", () => {
  test("maps TB last_fetched_at into the component DTO", async () => {
    const { componentIds } = await seedServiceWithComponents({
      slug: `${TEST_PREFIX}-dto`,
      components: [{ upstreamId: "only", name: "Only", position: 0 }],
    });

    const now = Date.now();
    const byId = new Map<string, number>();
    const onlyId = componentIds[0];
    if (onlyId === undefined) throw new Error("seed failure");
    byId.set(String(onlyId), now);

    const ctx = makeCtx({ kind: "byId", byId });
    const caller = edgeRouter.createCaller(ctx);
    const res = await caller.externalService.component({
      serviceSlug: `${TEST_PREFIX}-dto`,
      componentSlug: "only",
    });

    expect(res.found).toBe(true);
    expect(res.component?.lastFetchedAt).toBe(now);
    expect(res.component?.stale).toBe(false);
  });

  test("missing TB row maps to lastFetchedAt = 0 and stale = true", async () => {
    await seedServiceWithComponents({
      slug: `${TEST_PREFIX}-dtomiss`,
      components: [{ upstreamId: "only", name: "Only", position: 0 }],
    });

    const ctx = makeCtx({ kind: "empty" });
    const caller = edgeRouter.createCaller(ctx);
    const res = await caller.externalService.component({
      serviceSlug: `${TEST_PREFIX}-dtomiss`,
      componentSlug: "only",
    });

    expect(res.found).toBe(true);
    expect(res.component?.lastFetchedAt).toBe(0);
    expect(res.component?.stale).toBe(true);
  });
});
