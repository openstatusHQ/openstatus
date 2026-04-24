import { afterAll, beforeAll, expect, test } from "bun:test";
import { db, eq, inArray } from "@openstatus/db";
import {
  maintenance,
  maintenancesToPageComponents,
  page,
  pageComponent,
  pageComponentGroup,
  statusReport,
  statusReportUpdate,
  statusReportsToPageComponents,
} from "@openstatus/db/src/schema";
import { allPlans } from "@openstatus/db/src/schema/plan/config";
import type { Limits } from "@openstatus/db/src/schema/plan/schema";
import {
  MOCK_COMPONENTS,
  MOCK_COMPONENT_GROUPS,
  MOCK_INCIDENTS,
  MOCK_PAGES,
  MOCK_SUBSCRIBERS,
} from "@openstatus/importers/statuspage/fixtures";

import { edgeRouter } from "../edge";
import { createInnerTRPCContext } from "../trpc";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const originalFetch = globalThis.fetch;

function mockStatuspageFetch() {
  globalThis.fetch = ((url: string | URL | Request) => {
    const urlStr = typeof url === "string" ? url : url.toString();
    let data: unknown = [];

    // For paginated endpoints, return empty on page > 1
    const pageParam = urlStr.includes("?")
      ? new URL(urlStr).searchParams.get("page")
      : null;
    const isFirstPage = !pageParam || pageParam === "1";

    if (urlStr.endsWith("/pages")) data = MOCK_PAGES;
    else if (urlStr.includes("/component-groups"))
      data = isFirstPage ? MOCK_COMPONENT_GROUPS : [];
    else if (urlStr.includes("/components"))
      data = isFirstPage ? MOCK_COMPONENTS : [];
    else if (urlStr.includes("/incidents/scheduled"))
      data = isFirstPage
        ? MOCK_INCIDENTS.filter((i) => i.scheduled_for != null)
        : [];
    else if (urlStr.includes("/incidents"))
      data = isFirstPage ? MOCK_INCIDENTS : [];
    else if (urlStr.includes("/subscribers"))
      data = isFirstPage ? MOCK_SUBSCRIBERS : [];

    return Promise.resolve(
      new Response(JSON.stringify(data), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  }) as typeof globalThis.fetch;
}

function restoreFetch() {
  globalThis.fetch = originalFetch;
}

function makeCaller(limitsOverride?: Partial<Limits>, workspaceId = 1) {
  const limits = { ...allPlans.starter.limits, ...limitsOverride };
  const ctx = createInnerTRPCContext({
    req: undefined,
    session: { user: { id: "1" } },
    // @ts-expect-error - minimal workspace for test
    workspace: { id: workspaceId, limits },
    // Populate `user` too so the `NODE_ENV=test` escape hatch in
    // `enforceUserIsAuthed` takes — otherwise the middleware would
    // fall through to the DB read and replace our override limits
    // with the seeded team-plan workspace, making every assertion
    // below a no-op against the real team plan.
    // @ts-expect-error - minimal user for test
    user: { id: 1 },
  });
  return edgeRouter.createCaller(ctx);
}

// Track all created IDs for cleanup
const createdIds = {
  pages: [] as number[],
  componentGroups: [] as number[],
  components: [] as number[],
  statusReports: [] as number[],
  maintenances: [] as number[],
};

async function cleanup() {
  // Delete in reverse dependency order

  // 1. statusReportsToPageComponents
  if (createdIds.statusReports.length > 0) {
    await db
      .delete(statusReportsToPageComponents)
      .where(
        inArray(
          statusReportsToPageComponents.statusReportId,
          createdIds.statusReports,
        ),
      );
  }

  // 2. maintenancesToPageComponents
  if (createdIds.maintenances.length > 0) {
    await db
      .delete(maintenancesToPageComponents)
      .where(
        inArray(
          maintenancesToPageComponents.maintenanceId,
          createdIds.maintenances,
        ),
      );
  }

  // 3. statusReportUpdate (via statusReportId)
  if (createdIds.statusReports.length > 0) {
    await db
      .delete(statusReportUpdate)
      .where(
        inArray(statusReportUpdate.statusReportId, createdIds.statusReports),
      );
  }

  // 4. statusReport
  if (createdIds.statusReports.length > 0) {
    await db
      .delete(statusReport)
      .where(inArray(statusReport.id, createdIds.statusReports));
  }

  // 5. maintenance
  if (createdIds.maintenances.length > 0) {
    await db
      .delete(maintenance)
      .where(inArray(maintenance.id, createdIds.maintenances));
  }

  // 6. pageComponent
  if (createdIds.components.length > 0) {
    await db
      .delete(pageComponent)
      .where(inArray(pageComponent.id, createdIds.components));
  }

  // 7. pageComponentGroup
  if (createdIds.componentGroups.length > 0) {
    await db
      .delete(pageComponentGroup)
      .where(inArray(pageComponentGroup.id, createdIds.componentGroups));
  }

  // 8. page (only ones we created, never the seeded page 1)
  if (createdIds.pages.length > 0) {
    await db.delete(page).where(inArray(page.id, createdIds.pages));
  }

  // Reset trackers
  createdIds.pages = [];
  createdIds.componentGroups = [];
  createdIds.components = [];
  createdIds.statusReports = [];
  createdIds.maintenances = [];
}

/** Collect IDs from import summary phases for cleanup tracking. */
function trackCreatedIds(summary: {
  phases: Array<{
    phase: string;
    resources: Array<{ openstatusId?: number; status: string }>;
  }>;
}) {
  for (const phase of summary.phases) {
    const ids = phase.resources
      .filter((r) => r.status === "created" && r.openstatusId)
      .map((r) => r.openstatusId as number);

    switch (phase.phase) {
      case "page":
        createdIds.pages.push(...ids);
        break;
      case "componentGroups":
        createdIds.componentGroups.push(...ids);
        break;
      case "components":
        createdIds.components.push(...ids);
        break;
      case "incidents":
        createdIds.statusReports.push(...ids);
        break;
      case "maintenances":
        createdIds.maintenances.push(...ids);
        break;
    }
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeAll(() => {
  mockStatuspageFetch();
});

afterAll(async () => {
  restoreFetch();
  await cleanup();
});

const caller = makeCaller();

test("preview returns mapped data without DB writes", async () => {
  const result = await caller.import.preview({
    provider: "statuspage",
    apiKey: "test-key",
  });

  expect(result.provider).toBe("statuspage");
  expect(result.phases.length).toBeGreaterThan(0);

  // Check that expected phases exist
  const phaseNames = result.phases.map((p) => p.phase);
  expect(phaseNames).toContain("page");
  expect(phaseNames).toContain("components");
  expect(phaseNames).toContain("componentGroups");

  // Verify resource counts match fixture data
  const pagePh = result.phases.find((p) => p.phase === "page");
  expect(pagePh?.resources.length).toBe(MOCK_PAGES.length);

  const compPh = result.phases.find((p) => p.phase === "components");
  expect(compPh?.resources.length).toBe(MOCK_COMPONENTS.length);

  const groupPh = result.phases.find((p) => p.phase === "componentGroups");
  expect(groupPh?.resources.length).toBe(MOCK_COMPONENT_GROUPS.length);

  // Verify no pages were created in DB with the slug from mock
  const dbPage = await db
    .select()
    .from(page)
    .where(eq(page.slug, "acmecorp"))
    .get();
  expect(dbPage).toBeUndefined();
});

test("run creates page, components, and groups in DB", async () => {
  const result = await caller.import.run({
    provider: "statuspage",
    apiKey: "test-key",
    options: { includeStatusReports: true, includeSubscribers: false },
  });

  trackCreatedIds(result);

  // Overall status should be completed (subscribers skipped but that's fine)
  expect(["completed", "partial"]).toContain(result.status);

  // Page should be created with slug "acmecorp"
  const dbPage = await db
    .select()
    .from(page)
    .where(eq(page.slug, "acmecorp"))
    .get();
  if (!dbPage)
    throw new Error("Expected page to be created with slug 'acmecorp'");
  expect(dbPage.title).toBe("Acme Corp Status");
  expect(dbPage.workspaceId).toBe(1);

  // Components should be created
  const dbComponents = await db
    .select()
    .from(pageComponent)
    .where(eq(pageComponent.pageId, dbPage.id))
    .all();
  expect(dbComponents.length).toBe(MOCK_COMPONENTS.length);

  // Groups should be created
  const dbGroups = await db
    .select()
    .from(pageComponentGroup)
    .where(eq(pageComponentGroup.pageId, dbPage.id))
    .all();
  expect(dbGroups.length).toBe(MOCK_COMPONENT_GROUPS.length);

  // Subscribers phase should be skipped
  const subPhase = result.phases.find((p) => p.phase === "subscribers");
  expect(subPhase?.status).toBe("skipped");

  // Clean up for next tests
  await cleanup();
});

test("run with existing pageId imports into that page", async () => {
  const result = await caller.import.run({
    provider: "statuspage",
    apiKey: "test-key",
    pageId: 1,
    options: { includeStatusReports: false, includeSubscribers: false },
  });

  trackCreatedIds(result);

  expect(["completed", "partial"]).toContain(result.status);

  // Page phase should show "skipped" since we used an existing page
  const pagePhase = result.phases.find((p) => p.phase === "page");
  expect(pagePhase?.resources[0]?.status).toBe("skipped");
  expect(pagePhase?.resources[0]?.openstatusId).toBe(1);

  // Components should be created under page 1
  const dbComponents = await db
    .select()
    .from(pageComponent)
    .where(eq(pageComponent.pageId, 1))
    .all();
  // At least the components we imported should exist
  const importedCompNames = MOCK_COMPONENTS.map((c) => c.name);
  const matchingComps = dbComponents.filter((c) =>
    importedCompNames.includes(c.name),
  );
  expect(matchingComps.length).toBe(MOCK_COMPONENTS.length);

  await cleanup();
});

test("re-run skips already-imported resources (idempotency)", async () => {
  // First run
  const result1 = await caller.import.run({
    provider: "statuspage",
    apiKey: "test-key",
    options: { includeStatusReports: false, includeSubscribers: false },
  });
  trackCreatedIds(result1);

  // Second run (same data)
  const result2 = await caller.import.run({
    provider: "statuspage",
    apiKey: "test-key",
    options: { includeStatusReports: false, includeSubscribers: false },
  });
  // Don't track again - same resources should be skipped

  // Page should be skipped on second run
  const pagePhase = result2.phases.find((p) => p.phase === "page");
  expect(pagePhase?.resources[0]?.status).toBe("skipped");

  // Components should be skipped on second run
  const compPhase = result2.phases.find((p) => p.phase === "components");
  const allSkipped = compPhase?.resources.every((r) => r.status === "skipped");
  expect(allSkipped).toBe(true);

  // Groups should be skipped on second run
  const groupPhase = result2.phases.find((p) => p.phase === "componentGroups");
  const allGroupsSkipped = groupPhase?.resources.every(
    (r) => r.status === "skipped",
  );
  expect(allGroupsSkipped).toBe(true);

  await cleanup();
});

test("run with includeStatusReports creates status reports", async () => {
  const result = await caller.import.run({
    provider: "statuspage",
    apiKey: "test-key",
    options: { includeStatusReports: true, includeSubscribers: false },
  });

  trackCreatedIds(result);

  // Incidents phase should be completed
  const incPhase = result.phases.find((p) => p.phase === "incidents");
  expect(incPhase).toBeDefined();
  expect(incPhase?.status).toBe("completed");

  if (!incPhase) throw new Error("Expected incidents phase to exist");

  // Verify status reports were created in DB
  const createdReportIds = incPhase.resources
    .filter((r) => r.status === "created" && r.openstatusId)
    .map((r) => r.openstatusId as number);
  expect(createdReportIds.length).toBeGreaterThan(0);

  // Check that status report updates were created
  const updates = await db
    .select()
    .from(statusReportUpdate)
    .where(inArray(statusReportUpdate.statusReportId, createdReportIds))
    .all();
  expect(updates.length).toBeGreaterThan(0);

  // Check that statusReportsToPageComponents links exist
  const links = await db
    .select()
    .from(statusReportsToPageComponents)
    .where(
      inArray(statusReportsToPageComponents.statusReportId, createdReportIds),
    )
    .all();
  expect(links.length).toBeGreaterThan(0);

  // Maintenances phase should also have entries (scheduled incident)
  const maintPhase = result.phases.find((p) => p.phase === "maintenances");
  if (!maintPhase) throw new Error("Expected maintenances phase to exist");
  const createdMaintIds = maintPhase.resources
    .filter((r) => r.status === "created" && r.openstatusId)
    .map((r) => r.openstatusId as number);
  expect(createdMaintIds.length).toBeGreaterThan(0);

  await cleanup();
});

// ---------------------------------------------------------------------------
// Limit warnings (go through the caller with custom workspace limits to
// drive the service's plan gates)
// ---------------------------------------------------------------------------

const freeLimits = { ...allPlans.free.limits };
const starterLimits = { ...allPlans.starter.limits };

test("preview shows component limit warning on free plan", async () => {
  // Use workspaceId 2 (free seed) so the workspace-wide component count
  // starts at 0 — workspace 1 has 2 seeded page components from the
  // shared seed, which would make `remaining = 1` instead of 3 and
  // change the warning wording.
  const c = makeCaller({ ...freeLimits, "page-components": 3 }, 2);
  const result = await c.import.preview({
    provider: "statuspage",
    apiKey: "test-key",
  });

  expect(result.errors.length).toBeGreaterThan(0);
  // Warning was reworded to clarify the worst-case count (see
  // `limits.ts` — dropped the `"X of Y"` fraction because it implied
  // a hard rejection count when duplicates would actually be skipped).
  expect(result.errors.some((e) => e.includes("3 new component"))).toBe(true);
});

test("preview shows custom domain warning on free plan", async () => {
  const c = makeCaller({ ...freeLimits, "custom-domain": false });
  const result = await c.import.preview({
    provider: "statuspage",
    apiKey: "test-key",
  });

  expect(result.errors.some((e) => e.includes("Custom domain"))).toBe(true);
});

test("preview shows subscriber warning on free plan", async () => {
  const c = makeCaller({ ...freeLimits, "status-subscribers": false });
  // Pass `options.includeSubscribers: true` explicitly — the warning
  // fires only when the user *intends* to import subscribers (and the
  // plan disallows it). Default `includeSubscribers` is `false`
  // (matches `ImportOptions`), so without the override the preview
  // correctly stays silent for users who aren't importing subscribers.
  const result = await c.import.preview({
    provider: "statuspage",
    apiKey: "test-key",
    options: { includeSubscribers: true },
  });

  expect(result.errors.some((e) => e.includes("Subscribers"))).toBe(true);
});

test("preview shows no warnings on starter plan", async () => {
  const c = makeCaller(starterLimits);
  const result = await c.import.preview({
    provider: "statuspage",
    apiKey: "test-key",
  });

  // Only informational warnings about non-email subscribers are expected
  const limitWarnings = result.errors.filter(
    (e) => !e.includes("non-email subscriber"),
  );
  expect(limitWarnings).toEqual([]);
});

test("run enforces component limit by truncating", async () => {
  // Create a dedicated page so we control the state entirely
  const [testPage] = await db
    .insert(page)
    .values({
      workspaceId: 1,
      title: "Truncation Test Page",
      description: "",
      slug: "truncation-test",
      customDomain: "",
      icon: "",
    })
    .returning({ id: page.id });

  if (!testPage) throw new Error("Failed to create test page");
  createdIds.pages.push(testPage.id);

  const c = makeCaller({ ...starterLimits, "page-components": 2 });
  const result = await c.import.run({
    provider: "statuspage",
    apiKey: "test-key",
    pageId: testPage.id,
    options: { includeStatusReports: false, includeSubscribers: false },
  });

  trackCreatedIds(result);

  // Should have warning about component limit
  expect(
    result.errors.some(
      (e) =>
        e.includes("page-components") ||
        e.includes("Component limit") ||
        e.includes("components can be imported") ||
        e.includes("plan limit"),
    ),
  ).toBe(true);

  // Components phase should show enforcement (either truncated or fully blocked)
  const compPhase = result.phases.find((p) => p.phase === "components");
  expect(compPhase).toBeDefined();
  // With limit of 2, not all 4 mock components should be created
  const created =
    compPhase?.resources.filter((r) => r.status === "created") ?? [];
  expect(created.length).toBeLessThanOrEqual(2);

  await cleanup();
});

test("run skips subscribers on free plan", async () => {
  const c = makeCaller({ ...freeLimits, "status-subscribers": false });
  const result = await c.import.run({
    provider: "statuspage",
    apiKey: "test-key",
    options: { includeStatusReports: false, includeSubscribers: true },
  });

  trackCreatedIds(result);

  const subPhase = result.phases.find((p) => p.phase === "subscribers");
  expect(subPhase?.status).toBe("skipped");
  expect(result.errors.some((e) => e.includes("Subscribers"))).toBe(true);

  await cleanup();
});
