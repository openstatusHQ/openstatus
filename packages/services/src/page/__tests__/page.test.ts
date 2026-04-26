import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { db, eq } from "@openstatus/db";
import { monitor, pageComponent } from "@openstatus/db/src/schema";

import {
  SEEDED_WORKSPACE_FREE_ID,
  SEEDED_WORKSPACE_TEAM_ID,
} from "../../../test/fixtures";
import {
  cleanQuotaGatedTables,
  expectAuditRow,
  loadSeededWorkspace,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { ServiceContext } from "../../context";
import {
  ConflictError,
  ForbiddenError,
  LimitExceededError,
  NotFoundError,
} from "../../errors";
import { createPage, newPage } from "../create";
import { deletePage } from "../delete";
import { getPage, getPageBySlug, getSlugAvailable, listPages } from "../list";
import { updatePageGeneral, updatePageLocales } from "../update";

const TEST_PREFIX = "svc-page-test";

let teamCtx: ServiceContext;
let freeCtx: ServiceContext;
let teamMonitorId: number;

beforeAll(async () => {
  const team = await loadSeededWorkspace(SEEDED_WORKSPACE_TEAM_ID);
  const free = await loadSeededWorkspace(SEEDED_WORKSPACE_FREE_ID);
  teamCtx = makeUserCtx(team, { userId: 1 });
  freeCtx = makeUserCtx(free, { userId: 2 });

  // Clear leftover quota-gated rows on the free workspace so
  // negative-path tests hit their intended assertion (e.g.
  // `assertStatusPageQuota` on free = 1 page) regardless of what
  // prior runs left behind.
  await cleanQuotaGatedTables(SEEDED_WORKSPACE_FREE_ID);

  const teamMonitor = await db
    .insert(monitor)
    .values({
      workspaceId: team.id,
      active: true,
      url: "https://example.com",
      name: `${TEST_PREFIX}-monitor`,
      method: "GET",
      periodicity: "10m",
      regions: "ams",
    })
    .returning()
    .get();
  teamMonitorId = teamMonitor.id;
});

afterAll(async () => {
  await db
    .delete(monitor)
    .where(eq(monitor.id, teamMonitorId))
    .catch(() => undefined);
});

let slugCounter = 0;
const uniqueSlug = (tag: string) => `${TEST_PREFIX}-${tag}-${++slugCounter}`;

describe("newPage", () => {
  test("happy path + audit", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const slug = uniqueSlug("new");
      const row = await newPage({
        ctx,
        input: { title: "Test", slug },
      });
      expect(row.slug).toBe(slug);
      await expectAuditRow({
        workspaceId: teamCtx.workspace.id,
        action: "page.create",
        entityType: "page",
        entityId: row.id,
        db: tx,
      });
    });
  });

  test("rejects reserved subdomain", async () => {
    await withTestTransaction(async (tx) => {
      await expect(
        newPage({
          ctx: { ...teamCtx, db: tx },
          input: { title: "Test", slug: "api" },
        }),
      ).rejects.toBeInstanceOf(ConflictError);
    });
  });

  test("rejects duplicate slug", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const slug = uniqueSlug("dup");
      await newPage({
        ctx,
        input: { title: "First", slug },
      });
      await expect(
        newPage({ ctx, input: { title: "Second", slug } }),
      ).rejects.toBeInstanceOf(ConflictError);
    });
  });
});

describe("createPage (full form)", () => {
  test("attaches monitors as pageComponents", async () => {
    await withTestTransaction(async (tx) => {
      const slug = uniqueSlug("full");
      const row = await createPage({
        ctx: { ...teamCtx, db: tx },
        input: {
          title: "Full Create",
          slug,
          description: "desc",
          customDomain: "",
          workspaceId: SEEDED_WORKSPACE_TEAM_ID,
          monitors: [{ monitorId: teamMonitorId }],
        },
      });
      const components = await tx
        .select()
        .from(pageComponent)
        .where(eq(pageComponent.pageId, row.id))
        .all();
      expect(components.map((c) => c.monitorId)).toEqual([teamMonitorId]);
    });
  });

  test("rejects cross-workspace monitor", async () => {
    await withTestTransaction(async (tx) => {
      const slug = uniqueSlug("cross-ws");
      await expect(
        createPage({
          ctx: { ...freeCtx, db: tx },
          input: {
            title: "Cross",
            slug,
            description: "",
            customDomain: "",
            workspaceId: SEEDED_WORKSPACE_FREE_ID,
            monitors: [{ monitorId: teamMonitorId }],
          },
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });
});

describe("updatePageGeneral", () => {
  test("updates title + slug; rejects duplicate slug", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const a = await newPage({
        ctx,
        input: { title: "A", slug: uniqueSlug("a") },
      });
      const b = await newPage({
        ctx,
        input: { title: "B", slug: uniqueSlug("b") },
      });

      // Rename A to a new slug — fine.
      const newSlug = uniqueSlug("a-renamed");
      await updatePageGeneral({
        ctx,
        input: { id: a.id, title: "A Renamed", slug: newSlug },
      });

      // Rename A to B's slug — conflict.
      await expect(
        updatePageGeneral({
          ctx,
          input: { id: a.id, title: "A", slug: b.slug },
        }),
      ).rejects.toBeInstanceOf(ConflictError);
    });
  });

  test("cross-workspace → NotFoundError", async () => {
    await withTestTransaction(async (tx) => {
      const p = await newPage({
        ctx: { ...teamCtx, db: tx },
        input: { title: "Team", slug: uniqueSlug("ws-iso") },
      });
      await expect(
        updatePageGeneral({
          ctx: { ...freeCtx, db: tx },
          input: { id: p.id, title: "Hacked", slug: uniqueSlug("hack") },
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});

describe("updatePageLocales", () => {
  test("rejects when plan lacks i18n", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...freeCtx, db: tx };
      // free plan has i18n: false
      const p = await newPage({
        ctx,
        input: { title: "Free", slug: uniqueSlug("free") },
      });
      await expect(
        updatePageLocales({
          ctx,
          input: { id: p.id, defaultLocale: "en", locales: ["en"] },
        }),
      ).rejects.toBeInstanceOf(LimitExceededError);
    });
  });
});

describe("list / get / getSlugAvailable", () => {
  test("list respects workspace isolation", async () => {
    await withTestTransaction(async (tx) => {
      const teamCtxTx = { ...teamCtx, db: tx };
      const freeCtxTx = { ...freeCtx, db: tx };
      const p = await newPage({
        ctx: teamCtxTx,
        input: { title: "List Test", slug: uniqueSlug("list") },
      });

      const teamItems = await listPages({
        ctx: teamCtxTx,
        input: { order: "desc" },
      });
      expect(teamItems.find((x) => x.id === p.id)).toBeDefined();

      const freeItems = await listPages({
        ctx: freeCtxTx,
        input: { order: "desc" },
      });
      expect(freeItems.find((x) => x.id === p.id)).toBeUndefined();
    });
  });

  test("get cross-workspace → NotFoundError", async () => {
    await withTestTransaction(async (tx) => {
      const p = await newPage({
        ctx: { ...teamCtx, db: tx },
        input: { title: "Get", slug: uniqueSlug("get") },
      });
      await expect(
        getPage({ ctx: { ...freeCtx, db: tx }, input: { id: p.id } }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  test("getSlugAvailable handles reserved + taken", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const p = await newPage({
        ctx,
        input: { title: "Slug", slug: uniqueSlug("slug") },
      });

      expect(await getSlugAvailable({ ctx, input: { slug: p.slug } })).toBe(
        false,
      );
      expect(await getSlugAvailable({ ctx, input: { slug: "api" } })).toBe(
        false,
      );
      expect(
        await getSlugAvailable({
          ctx,
          input: { slug: uniqueSlug("free-slug") },
        }),
      ).toBe(true);
    });
  });
});

describe("getPageBySlug", () => {
  test("returns the row when slug exists", async () => {
    await withTestTransaction(async (tx) => {
      const p = await newPage({
        ctx: { ...teamCtx, db: tx },
        input: { title: "BySlug", slug: uniqueSlug("by-slug") },
      });

      const row = await getPageBySlug({ input: { slug: p.slug } }, { db: tx });
      expect(row?.id).toBe(p.id);
      expect(row?.slug).toBe(p.slug);
    });
  });

  test("normalizes slug casing", async () => {
    await withTestTransaction(async (tx) => {
      const slug = uniqueSlug("case");
      const p = await newPage({
        ctx: { ...teamCtx, db: tx },
        input: { title: "Case", slug },
      });

      const upper = await getPageBySlug(
        { input: { slug: slug.toUpperCase() } },
        { db: tx },
      );
      expect(upper?.id).toBe(p.id);
    });
  });

  test("returns undefined when slug is missing", async () => {
    await withTestTransaction(async (tx) => {
      const row = await getPageBySlug(
        { input: { slug: `${TEST_PREFIX}-missing-${Date.now()}` } },
        { db: tx },
      );
      expect(row).toBeUndefined();
    });
  });

  test("ignores workspace scope (cross-workspace lookup)", async () => {
    await withTestTransaction(async (tx) => {
      // Page lives in the team workspace; querying without any ctx still
      // resolves it — this is the contract that lets the public status-page
      // render path resolve a slug for unauthenticated visitors.
      const p = await newPage({
        ctx: { ...teamCtx, db: tx },
        input: { title: "Cross", slug: uniqueSlug("cross") },
      });

      const row = await getPageBySlug({ input: { slug: p.slug } }, { db: tx });
      expect(row?.workspaceId).toBe(teamCtx.workspace.id);
      // (No `ctx` passed → confirms the helper does not rely on
      // workspace scoping; `db: tx` only routes the read through our
      // wrapping test tx so it sees the row created above.)
    });
  });
});

describe("deletePage", () => {
  test("cross-workspace → NotFoundError", async () => {
    await withTestTransaction(async (tx) => {
      const p = await newPage({
        ctx: { ...teamCtx, db: tx },
        input: { title: "Delete", slug: uniqueSlug("del") },
      });
      await expect(
        deletePage({ ctx: { ...freeCtx, db: tx }, input: { id: p.id } }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
