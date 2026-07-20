import { db, eq } from "@openstatus/db";
import {
  monitor,
  page as pageTable,
  pageComponent,
  selectWorkspaceSchema,
  workspace,
} from "@openstatus/db/src/schema";
import { getLimits } from "@openstatus/db/src/schema/plan/utils";
import { expect } from "@std/expect";
import { afterAll, beforeAll, describe, test } from "@std/testing/bdd";

import { SEEDED_WORKSPACE_TEAM_ID } from "../../../test/fixtures";
import {
  expectAuditRow,
  loadSeededWorkspace,
  makeApiKeyCtx,
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
import {
  updatePageCustomTheme,
  updatePageGeneral,
  updatePageLocales,
} from "../update";

const TEST_PREFIX = "svc-page-test";

let teamCtx: ServiceContext;
let freeCtx: ServiceContext;
let teamMonitorId: number;

// Dedicated, freshly-inserted free-plan workspace for the quota-sensitive
// negative-path tests (status-pages limit = 1). They assume exclusive control
// of the workspace's page count, but the shared seeded free workspace (#2) is
// written concurrently by the apps/server RPC suites under parallel test
// execution — which intermittently exhausts the quota and fails the wrong
// assertion. An isolated workspace removes that cross-suite race; because every
// test writes inside a rolled-back transaction, its committed page count stays
// at zero for the whole suite.
const FREE_WS_SLUG = `${TEST_PREFIX}-free-ws`;

beforeAll(async () => {
  const team = await loadSeededWorkspace(SEEDED_WORKSPACE_TEAM_ID);
  teamCtx = makeUserCtx(team, { userId: 1 });

  await db
    .delete(workspace)
    .where(eq(workspace.slug, FREE_WS_SLUG))
    .catch(() => undefined);
  const freeRow = await db
    .insert(workspace)
    .values({
      slug: FREE_WS_SLUG,
      name: `${TEST_PREFIX}-free`,
      plan: "free",
      limits: JSON.stringify(getLimits("free")),
    })
    .returning()
    .get();
  freeCtx = makeUserCtx(selectWorkspaceSchema.parse(freeRow), { userId: 2 });

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
  await db
    .delete(workspace)
    .where(eq(workspace.slug, FREE_WS_SLUG))
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
            workspaceId: freeCtx.workspace.id,
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

  test("rejects read-only actor", async () => {
    await withTestTransaction(async (tx) => {
      const p = await newPage({
        ctx: { ...teamCtx, db: tx },
        input: { title: "Team", slug: uniqueSlug("read-only") },
      });
      const readOnlyCtx = {
        ...makeApiKeyCtx(teamCtx.workspace, {
          keyId: "k-read",
          userId: 1,
          scopes: ["read"],
        }),
        db: tx,
      };
      await expect(
        updatePageGeneral({
          ctx: readOnlyCtx,
          input: {
            id: p.id,
            title: "Read-only Update",
            slug: uniqueSlug("read-only-update"),
          },
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
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

describe("updatePageCustomTheme", () => {
  test("happy path stores sanitized vars + audit", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const p = await newPage({
        ctx,
        input: { title: "Theme", slug: uniqueSlug("theme") },
      });
      await updatePageCustomTheme({
        ctx,
        input: {
          id: p.id,
          customTheme: {
            light: { "--primary": " red " },
            dark: { "--primary": "pink" },
          },
        },
      });
      const row = await tx
        .select()
        .from(pageTable)
        .where(eq(pageTable.id, p.id))
        .get();
      expect(row?.customTheme).toEqual({
        light: { "--primary": "red" },
        dark: { "--primary": "pink" },
      });
      await expectAuditRow({
        workspaceId: teamCtx.workspace.id,
        action: "page.update",
        entityType: "page",
        entityId: p.id,
        db: tx,
      });
    });
  });

  test("rejects unknown css variables", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      await expect(
        updatePageCustomTheme({
          ctx,
          input: { id: 1, customTheme: { light: { "--nope": "red" } } },
        }),
      ).rejects.toThrow("Unknown CSS variable");
    });
  });

  test("rejects values with style-tag breakout characters", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      await expect(
        updatePageCustomTheme({
          ctx,
          input: {
            id: 1,
            customTheme: { light: { "--primary": "red;} </style>" } },
          },
        }),
      ).rejects.toThrow("unsupported characters");
    });
  });

  test("empty custom theme clears the column", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const p = await newPage({
        ctx,
        input: { title: "Theme Clear", slug: uniqueSlug("theme-clear") },
      });
      await updatePageCustomTheme({
        ctx,
        input: { id: p.id, customTheme: { dark: { "--primary": "pink" } } },
      });
      await updatePageCustomTheme({
        ctx,
        input: { id: p.id, customTheme: { light: {}, dark: {} } },
      });
      const row = await tx
        .select()
        .from(pageTable)
        .where(eq(pageTable.id, p.id))
        .get();
      expect(row?.customTheme).toBeNull();
    });
  });

  test("rejects when plan lacks custom-theme", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...freeCtx, db: tx };
      // No page needed: the `custom-theme` limit check fires before the
      // page lookup (mirrors the read-only-actor case below). Creating a
      // page here would depend on the shared free workspace's status-pages
      // quota, which a parallel suite can exhaust → flaky LimitExceededError
      // on the wrong assertion.
      await expect(
        updatePageCustomTheme({
          ctx,
          input: { id: 1, customTheme: { light: { "--primary": "red" } } },
        }),
      ).rejects.toBeInstanceOf(LimitExceededError);
    });
  });

  test("rejects read-only actor", async () => {
    await withTestTransaction(async (tx) => {
      const readOnlyCtx = {
        ...makeApiKeyCtx(teamCtx.workspace, {
          keyId: "k-read",
          userId: 1,
          scopes: ["read"],
        }),
        db: tx,
      };
      await expect(
        updatePageCustomTheme({
          ctx: readOnlyCtx,
          input: { id: 1, customTheme: { light: { "--primary": "red" } } },
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
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
