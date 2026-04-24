import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { db, eq, inArray } from "@openstatus/db";
import { monitor, page, pageComponent } from "@openstatus/db/src/schema";

import {
  SEEDED_WORKSPACE_FREE_ID,
  SEEDED_WORKSPACE_TEAM_ID,
} from "../../../test/fixtures";
import {
  expectAuditRow,
  loadSeededWorkspace,
  makeUserCtx,
  withAuditBuffer,
} from "../../../test/helpers";
import type { AuditLogRecord } from "../../audit";
import type { ServiceContext } from "../../context";
import {
  ConflictError,
  ForbiddenError,
  LimitExceededError,
  NotFoundError,
} from "../../errors";
import { createPage, newPage } from "../create";
import { deletePage } from "../delete";
import { getPage, getSlugAvailable, listPages } from "../list";
import { updatePageGeneral, updatePageLocales } from "../update";

const TEST_PREFIX = "svc-page-test";

let teamCtx: ServiceContext;
let freeCtx: ServiceContext;
let teamMonitorId: number;
let auditBuffer: AuditLogRecord[];
let auditReset: () => void;
const createdPageIds: number[] = [];

beforeAll(async () => {
  const team = await loadSeededWorkspace(SEEDED_WORKSPACE_TEAM_ID);
  const free = await loadSeededWorkspace(SEEDED_WORKSPACE_FREE_ID);
  teamCtx = makeUserCtx(team, { userId: 1 });
  freeCtx = makeUserCtx(free, { userId: 2 });

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
  if (createdPageIds.length > 0) {
    await db
      .delete(pageComponent)
      .where(inArray(pageComponent.pageId, createdPageIds))
      .catch(() => undefined);
    await db
      .delete(page)
      .where(inArray(page.id, createdPageIds))
      .catch(() => undefined);
  }
  await db
    .delete(monitor)
    .where(eq(monitor.id, teamMonitorId))
    .catch(() => undefined);
});

beforeEach(() => {
  const hooks = withAuditBuffer();
  auditBuffer = hooks.buffer;
  auditReset = hooks.reset;
});

afterEach(() => {
  auditReset();
});

function track(id: number) {
  createdPageIds.push(id);
  return id;
}

let slugCounter = 0;
const uniqueSlug = (tag: string) => `${TEST_PREFIX}-${tag}-${++slugCounter}`;

describe("newPage", () => {
  test("happy path + audit", async () => {
    const slug = uniqueSlug("new");
    const row = await newPage({
      ctx: teamCtx,
      input: { title: "Test", slug },
    });
    track(row.id);
    expect(row.slug).toBe(slug);
    await expectAuditRow(auditBuffer, {
      action: "page.create",
      entityType: "page",
      entityId: row.id,
    });
  });

  test("rejects reserved subdomain", async () => {
    await expect(
      newPage({
        ctx: teamCtx,
        input: { title: "Test", slug: "api" },
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  test("rejects duplicate slug", async () => {
    const slug = uniqueSlug("dup");
    const first = await newPage({
      ctx: teamCtx,
      input: { title: "First", slug },
    });
    track(first.id);
    await expect(
      newPage({ ctx: teamCtx, input: { title: "Second", slug } }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("createPage (full form)", () => {
  test("attaches monitors as pageComponents", async () => {
    const slug = uniqueSlug("full");
    const row = await createPage({
      ctx: teamCtx,
      input: {
        title: "Full Create",
        slug,
        description: "desc",
        customDomain: "",
        monitors: [{ monitorId: teamMonitorId }],
      },
    });
    track(row.id);
    const components = await db
      .select()
      .from(pageComponent)
      .where(eq(pageComponent.pageId, row.id))
      .all();
    expect(components.map((c) => c.monitorId)).toEqual([teamMonitorId]);
  });

  test("rejects cross-workspace monitor", async () => {
    const slug = uniqueSlug("cross-ws");
    await expect(
      createPage({
        ctx: freeCtx,
        input: {
          title: "Cross",
          slug,
          description: "",
          customDomain: "",
          monitors: [{ monitorId: teamMonitorId }],
        },
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("updatePageGeneral", () => {
  test("updates title + slug; rejects duplicate slug", async () => {
    const a = await newPage({
      ctx: teamCtx,
      input: { title: "A", slug: uniqueSlug("a") },
    });
    const b = await newPage({
      ctx: teamCtx,
      input: { title: "B", slug: uniqueSlug("b") },
    });
    track(a.id);
    track(b.id);

    // Rename A to a new slug — fine.
    const newSlug = uniqueSlug("a-renamed");
    await updatePageGeneral({
      ctx: teamCtx,
      input: { id: a.id, title: "A Renamed", slug: newSlug },
    });

    // Rename A to B's slug — conflict.
    await expect(
      updatePageGeneral({
        ctx: teamCtx,
        input: { id: a.id, title: "A", slug: b.slug },
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  test("cross-workspace → NotFoundError", async () => {
    const p = await newPage({
      ctx: teamCtx,
      input: { title: "Team", slug: uniqueSlug("ws-iso") },
    });
    track(p.id);
    await expect(
      updatePageGeneral({
        ctx: freeCtx,
        input: { id: p.id, title: "Hacked", slug: uniqueSlug("hack") },
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("updatePageLocales", () => {
  test("rejects when plan lacks i18n", async () => {
    // free plan has i18n: false
    const p = await newPage({
      ctx: freeCtx,
      input: { title: "Free", slug: uniqueSlug("free") },
    });
    track(p.id);
    await expect(
      updatePageLocales({
        ctx: freeCtx,
        input: { id: p.id, defaultLocale: "en", locales: ["en"] },
      }),
    ).rejects.toBeInstanceOf(LimitExceededError);
  });
});

describe("list / get / getSlugAvailable", () => {
  test("list respects workspace isolation", async () => {
    const p = await newPage({
      ctx: teamCtx,
      input: { title: "List Test", slug: uniqueSlug("list") },
    });
    track(p.id);

    const teamItems = await listPages({
      ctx: teamCtx,
      input: { order: "desc" },
    });
    expect(teamItems.find((x) => x.id === p.id)).toBeDefined();

    const freeItems = await listPages({
      ctx: freeCtx,
      input: { order: "desc" },
    });
    expect(freeItems.find((x) => x.id === p.id)).toBeUndefined();
  });

  test("get cross-workspace → NotFoundError", async () => {
    const p = await newPage({
      ctx: teamCtx,
      input: { title: "Get", slug: uniqueSlug("get") },
    });
    track(p.id);
    await expect(
      getPage({ ctx: freeCtx, input: { id: p.id } }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  test("getSlugAvailable handles reserved + taken", async () => {
    const p = await newPage({
      ctx: teamCtx,
      input: { title: "Slug", slug: uniqueSlug("slug") },
    });
    track(p.id);

    expect(
      await getSlugAvailable({ ctx: teamCtx, input: { slug: p.slug } }),
    ).toBe(false);
    expect(
      await getSlugAvailable({ ctx: teamCtx, input: { slug: "api" } }),
    ).toBe(false);
    expect(
      await getSlugAvailable({
        ctx: teamCtx,
        input: { slug: uniqueSlug("free-slug") },
      }),
    ).toBe(true);
  });
});

describe("deletePage", () => {
  test("cross-workspace → NotFoundError", async () => {
    const p = await newPage({
      ctx: teamCtx,
      input: { title: "Delete", slug: uniqueSlug("del") },
    });
    track(p.id);
    await expect(
      deletePage({ ctx: freeCtx, input: { id: p.id } }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
