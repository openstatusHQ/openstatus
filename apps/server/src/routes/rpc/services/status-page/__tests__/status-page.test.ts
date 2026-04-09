import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { db, eq, sql } from "@openstatus/db";
import {
  monitor,
  page,
  pageComponent,
  pageComponentGroup,
  pageSubscriber,
  statusReport,
  statusReportsToPageComponents,
} from "@openstatus/db/src/schema";

import { app } from "@/index";

/**
 * Helper to make ConnectRPC requests using the Connect protocol (JSON).
 * Connect uses POST with JSON body at /rpc/<service>/<method>
 */
async function connectRequest(
  method: string,
  body: Record<string, unknown> = {},
  headers: Record<string, string> = {},
) {
  return app.request(
    `/rpc/openstatus.status_page.v1.StatusPageService/${method}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
    },
  );
}

const TEST_PREFIX = "rpc-status-page-test";
let testPageId: number;
let testPageSlug: string;
let testPageToDeleteId: number;
let testPageToUpdateId: number;
let testComponentId: number;
let testComponentToDeleteId: number;
let testComponentToUpdateId: number;
let testGroupId: number;
let testGroupToDeleteId: number;
let testGroupToUpdateId: number;
let testMonitorId: number;
let testSubscriberId: number;
let testPasswordPageId: number;
let testPasswordPageSlug: string;

beforeAll(async () => {
  // Ensure workspace 1 has email-domain-protection enabled for AUTHENTICATED tests
  await db.run(
    sql`UPDATE workspace SET limits = json_set(COALESCE(limits, '{}'), '$."email-domain-protection"', json('true')) WHERE id = 1`,
  );

  // Clean up any existing test data
  await db
    .delete(pageSubscriber)
    .where(eq(pageSubscriber.email, `${TEST_PREFIX}@example.com`));
  await db
    .delete(pageComponent)
    .where(eq(pageComponent.name, `${TEST_PREFIX}-component`));
  await db
    .delete(pageComponent)
    .where(eq(pageComponent.name, `${TEST_PREFIX}-component-to-delete`));
  await db
    .delete(pageComponent)
    .where(eq(pageComponent.name, `${TEST_PREFIX}-component-to-update`));
  await db
    .delete(pageComponentGroup)
    .where(eq(pageComponentGroup.name, `${TEST_PREFIX}-group`));
  await db
    .delete(pageComponentGroup)
    .where(eq(pageComponentGroup.name, `${TEST_PREFIX}-group-to-delete`));
  await db
    .delete(pageComponentGroup)
    .where(eq(pageComponentGroup.name, `${TEST_PREFIX}-group-to-update`));
  await db.delete(page).where(eq(page.slug, `${TEST_PREFIX}-slug`));
  await db.delete(page).where(eq(page.slug, `${TEST_PREFIX}-slug-to-delete`));
  await db.delete(page).where(eq(page.slug, `${TEST_PREFIX}-slug-to-update`));
  await db.delete(page).where(eq(page.slug, `${TEST_PREFIX}-password-slug`));
  await db.delete(monitor).where(eq(monitor.name, `${TEST_PREFIX}-monitor`));

  // Create a test monitor for component tests
  const testMonitor = await db
    .insert(monitor)
    .values({
      workspaceId: 1,
      name: `${TEST_PREFIX}-monitor`,
      url: "https://example.com",
      periodicity: "1m",
      active: true,
      jobType: "http",
    })
    .returning()
    .get();
  testMonitorId = testMonitor.id;

  // Create a test page (published and public for testing public access)
  const testPage = await db
    .insert(page)
    .values({
      workspaceId: 1,
      title: `${TEST_PREFIX}-page`,
      slug: `${TEST_PREFIX}-slug`,
      description: "Test page for status page tests",
      customDomain: "",
      published: true,
      accessType: "public",
    })
    .returning()
    .get();
  testPageId = testPage.id;
  testPageSlug = testPage.slug;

  // Create page to delete
  const pageToDelete = await db
    .insert(page)
    .values({
      workspaceId: 1,
      title: `${TEST_PREFIX}-page-to-delete`,
      slug: `${TEST_PREFIX}-slug-to-delete`,
      description: "Test page to delete",
      customDomain: "",
    })
    .returning()
    .get();
  testPageToDeleteId = pageToDelete.id;

  // Create page to update
  const pageToUpdate = await db
    .insert(page)
    .values({
      workspaceId: 1,
      title: `${TEST_PREFIX}-page-to-update`,
      slug: `${TEST_PREFIX}-slug-to-update`,
      description: "Test page to update",
      customDomain: "",
    })
    .returning()
    .get();
  testPageToUpdateId = pageToUpdate.id;

  // Create a test component group
  const testGroup = await db
    .insert(pageComponentGroup)
    .values({
      workspaceId: 1,
      pageId: testPageId,
      name: `${TEST_PREFIX}-group`,
    })
    .returning()
    .get();
  testGroupId = testGroup.id;

  // Create group to delete
  const groupToDelete = await db
    .insert(pageComponentGroup)
    .values({
      workspaceId: 1,
      pageId: testPageId,
      name: `${TEST_PREFIX}-group-to-delete`,
    })
    .returning()
    .get();
  testGroupToDeleteId = groupToDelete.id;

  // Create group to update
  const groupToUpdate = await db
    .insert(pageComponentGroup)
    .values({
      workspaceId: 1,
      pageId: testPageId,
      name: `${TEST_PREFIX}-group-to-update`,
    })
    .returning()
    .get();
  testGroupToUpdateId = groupToUpdate.id;

  // Create a test component
  const testComponent = await db
    .insert(pageComponent)
    .values({
      workspaceId: 1,
      pageId: testPageId,
      type: "static",
      name: `${TEST_PREFIX}-component`,
      description: "Test component",
      order: 100,
    })
    .returning()
    .get();
  testComponentId = testComponent.id;

  // Create component to delete
  const componentToDelete = await db
    .insert(pageComponent)
    .values({
      workspaceId: 1,
      pageId: testPageId,
      type: "static",
      name: `${TEST_PREFIX}-component-to-delete`,
      description: "Test component to delete",
      order: 101,
    })
    .returning()
    .get();
  testComponentToDeleteId = componentToDelete.id;

  // Create component to update
  const componentToUpdate = await db
    .insert(pageComponent)
    .values({
      workspaceId: 1,
      pageId: testPageId,
      type: "static",
      name: `${TEST_PREFIX}-component-to-update`,
      description: "Test component to update",
      order: 102,
    })
    .returning()
    .get();
  testComponentToUpdateId = componentToUpdate.id;

  // Create a test subscriber
  const testSubscriber = await db
    .insert(pageSubscriber)
    .values({
      pageId: testPageId,
      email: `${TEST_PREFIX}@example.com`,
      token: `${TEST_PREFIX}-token`,
      acceptedAt: new Date(),
    })
    .returning()
    .get();
  testSubscriberId = testSubscriber.id;

  // Create a test page with password protection for read tests
  const passwordPage = await db
    .insert(page)
    .values({
      workspaceId: 1,
      title: `${TEST_PREFIX}-password-page`,
      slug: `${TEST_PREFIX}-password-slug`,
      description: "Password protected test page",
      customDomain: "",
      published: true,
      accessType: "password",
      password: "test-secret-123",
      authEmailDomains: null,
      icon: "https://example.com/icon.png",
    })
    .returning()
    .get();
  testPasswordPageId = passwordPage.id;
  testPasswordPageSlug = passwordPage.slug;
});

afterAll(async () => {
  // Clean up test data in proper order
  await db
    .delete(pageSubscriber)
    .where(eq(pageSubscriber.email, `${TEST_PREFIX}@example.com`));
  await db
    .delete(pageSubscriber)
    .where(eq(pageSubscriber.email, `${TEST_PREFIX}-subscribe@example.com`));

  await db
    .delete(pageComponent)
    .where(eq(pageComponent.name, `${TEST_PREFIX}-component`));
  await db
    .delete(pageComponent)
    .where(eq(pageComponent.name, `${TEST_PREFIX}-component-to-delete`));
  await db
    .delete(pageComponent)
    .where(eq(pageComponent.name, `${TEST_PREFIX}-component-to-update`));

  await db
    .delete(pageComponentGroup)
    .where(eq(pageComponentGroup.name, `${TEST_PREFIX}-group`));
  await db
    .delete(pageComponentGroup)
    .where(eq(pageComponentGroup.name, `${TEST_PREFIX}-group-to-delete`));
  await db
    .delete(pageComponentGroup)
    .where(eq(pageComponentGroup.name, `${TEST_PREFIX}-group-to-update`));

  await db.delete(page).where(eq(page.slug, `${TEST_PREFIX}-slug`));
  await db.delete(page).where(eq(page.slug, `${TEST_PREFIX}-slug-to-delete`));
  await db.delete(page).where(eq(page.slug, `${TEST_PREFIX}-slug-to-update`));
  await db.delete(page).where(eq(page.slug, `${TEST_PREFIX}-created-slug`));
  await db
    .delete(page)
    .where(eq(page.slug, `${TEST_PREFIX}-locale-create-slug`));
  await db
    .delete(page)
    .where(eq(page.slug, `${TEST_PREFIX}-locale-default-slug`));
  await db
    .delete(page)
    .where(eq(page.slug, `${TEST_PREFIX}-locale-invalid-slug`));
  await db
    .delete(page)
    .where(eq(page.slug, `${TEST_PREFIX}-locale-dedup-slug`));
  await db
    .delete(page)
    .where(eq(page.slug, `${TEST_PREFIX}-i18n-limit-create-slug`));
  await db
    .delete(page)
    .where(eq(page.slug, `${TEST_PREFIX}-i18n-limit-update-slug`));

  await db.delete(page).where(eq(page.slug, `${TEST_PREFIX}-password-slug`));
  await db.delete(page).where(eq(page.slug, `${TEST_PREFIX}-icon-slug`));
  await db.delete(page).where(eq(page.slug, `${TEST_PREFIX}-domain-slug`));
  await db.delete(page).where(eq(page.slug, `${TEST_PREFIX}-theme-slug`));
  await db.delete(page).where(eq(page.slug, `${TEST_PREFIX}-pw-create-slug`));
  await db.delete(page).where(eq(page.slug, `${TEST_PREFIX}-auth-create-slug`));
  await db.delete(page).where(eq(page.slug, `${TEST_PREFIX}-public-pw-slug`));
  await db.delete(page).where(eq(page.slug, `${TEST_PREFIX}-limit-ws2-slug`));
  await db.delete(page).where(eq(page.slug, `${TEST_PREFIX}-trim-domain-slug`));

  await db.delete(monitor).where(eq(monitor.name, `${TEST_PREFIX}-monitor`));
});

// ==========================================================================
// Page CRUD
// ==========================================================================

describe("StatusPageService.CreateStatusPage", () => {
  test("creates a new status page", async () => {
    const res = await connectRequest(
      "CreateStatusPage",
      {
        title: `${TEST_PREFIX}-created`,
        description: "A new test page",
        slug: `${TEST_PREFIX}-created-slug`,
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("statusPage");
    expect(data.statusPage.title).toBe(`${TEST_PREFIX}-created`);
    expect(data.statusPage.description).toBe("A new test page");
    expect(data.statusPage.slug).toBe(`${TEST_PREFIX}-created-slug`);

    // Clean up
    await db.delete(page).where(eq(page.id, Number(data.statusPage.id)));
  });

  test("returns 401 when no auth key provided", async () => {
    const res = await connectRequest("CreateStatusPage", {
      title: "Unauthorized test",
      slug: "unauthorized-slug",
    });

    expect(res.status).toBe(401);
  });

  test("returns error when slug already exists", async () => {
    const res = await connectRequest(
      "CreateStatusPage",
      {
        title: "Duplicate slug test",
        slug: testPageSlug, // Already exists
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(409); // AlreadyExists
  });

  test("returns 403 when status page limit is exceeded", async () => {
    // Workspace 2 is on free plan with status-pages limit of 1
    // First, create a page for workspace 2 to hit the limit
    const firstPage = await db
      .insert(page)
      .values({
        workspaceId: 2,
        title: `${TEST_PREFIX}-limit-test`,
        slug: `${TEST_PREFIX}-limit-test-slug`,
        description: "First page for limit test",
        customDomain: "",
      })
      .returning()
      .get();

    try {
      // Try to create a second page - should fail with PermissionDenied
      const res = await connectRequest(
        "CreateStatusPage",
        {
          title: `${TEST_PREFIX}-limit-exceeded`,
          description: "Should fail due to limit",
          slug: `${TEST_PREFIX}-limit-exceeded-slug`,
        },
        { "x-openstatus-key": "2" },
      );

      expect(res.status).toBe(403); // PermissionDenied

      const data = await res.json();
      expect(data.message).toContain("Upgrade for more status pages");
    } finally {
      // Clean up
      await db.delete(page).where(eq(page.id, firstPage.id));
    }
  });
});

describe("StatusPageService.GetStatusPage", () => {
  test("returns status page by ID", async () => {
    const res = await connectRequest(
      "GetStatusPage",
      { id: String(testPageId) },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("statusPage");
    expect(data.statusPage.id).toBe(String(testPageId));
    expect(data.statusPage.slug).toBe(testPageSlug);
  });

  test("returns 401 when no auth key provided", async () => {
    const res = await connectRequest("GetStatusPage", {
      id: String(testPageId),
    });

    expect(res.status).toBe(401);
  });

  test("returns 404 for non-existent status page", async () => {
    const res = await connectRequest(
      "GetStatusPage",
      { id: "99999" },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(404);
  });

  test("returns error when ID is empty", async () => {
    const res = await connectRequest(
      "GetStatusPage",
      { id: "" },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(400);
  });

  test("returns 404 for status page in different workspace", async () => {
    // Create page in workspace 2
    const otherPage = await db
      .insert(page)
      .values({
        workspaceId: 2,
        title: `${TEST_PREFIX}-other-workspace`,
        slug: `${TEST_PREFIX}-other-workspace-slug`,
        description: "Other workspace page",
        customDomain: "",
      })
      .returning()
      .get();

    try {
      const res = await connectRequest(
        "GetStatusPage",
        { id: String(otherPage.id) },
        { "x-openstatus-key": "1" },
      );

      expect(res.status).toBe(404);
    } finally {
      await db.delete(page).where(eq(page.id, otherPage.id));
    }
  });
});

describe("StatusPageService.ListStatusPages", () => {
  test("returns status pages for authenticated workspace", async () => {
    const res = await connectRequest(
      "ListStatusPages",
      {},
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("statusPages");
    expect(Array.isArray(data.statusPages)).toBe(true);
    expect(data).toHaveProperty("totalSize");
  });

  test("returns 401 when no auth key provided", async () => {
    const res = await connectRequest("ListStatusPages", {});

    expect(res.status).toBe(401);
  });

  test("respects limit parameter", async () => {
    const res = await connectRequest(
      "ListStatusPages",
      { limit: 1 },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.statusPages?.length || 0).toBeLessThanOrEqual(1);
  });

  test("respects offset parameter", async () => {
    // Get first page
    const res1 = await connectRequest(
      "ListStatusPages",
      { limit: 1, offset: 0 },
      { "x-openstatus-key": "1" },
    );
    const data1 = await res1.json();

    // Get second page
    const res2 = await connectRequest(
      "ListStatusPages",
      { limit: 1, offset: 1 },
      { "x-openstatus-key": "1" },
    );
    const data2 = await res2.json();

    // Should have different pages if multiple exist
    if (data1.statusPages?.length > 0 && data2.statusPages?.length > 0) {
      expect(data1.statusPages[0].id).not.toBe(data2.statusPages[0].id);
    }
  });
});

describe("StatusPageService.UpdateStatusPage", () => {
  test("updates status page title", async () => {
    const res = await connectRequest(
      "UpdateStatusPage",
      {
        id: String(testPageToUpdateId),
        title: `${TEST_PREFIX}-updated-title`,
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("statusPage");
    expect(data.statusPage.title).toBe(`${TEST_PREFIX}-updated-title`);

    // Restore original title
    await db
      .update(page)
      .set({ title: `${TEST_PREFIX}-page-to-update` })
      .where(eq(page.id, testPageToUpdateId));
  });

  test("returns 401 when no auth key provided", async () => {
    const res = await connectRequest("UpdateStatusPage", {
      id: String(testPageToUpdateId),
      title: "Unauthorized update",
    });

    expect(res.status).toBe(401);
  });

  test("returns 404 for non-existent status page", async () => {
    const res = await connectRequest(
      "UpdateStatusPage",
      { id: "99999", title: "Non-existent update" },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(404);
  });

  test("returns error when slug conflicts with another page", async () => {
    const res = await connectRequest(
      "UpdateStatusPage",
      {
        id: String(testPageToUpdateId),
        slug: testPageSlug, // Already exists on another page
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(409);
  });

  test("updates locale settings", async () => {
    const res = await connectRequest(
      "UpdateStatusPage",
      {
        id: String(testPageToUpdateId),
        defaultLocale: "LOCALE_FR",
        locales: ["LOCALE_EN", "LOCALE_FR", "LOCALE_DE"],
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.statusPage.defaultLocale).toBe("LOCALE_FR");
    expect(data.statusPage.locales).toEqual([
      "LOCALE_EN",
      "LOCALE_FR",
      "LOCALE_DE",
    ]);

    // Restore defaults
    await db
      .update(page)
      .set({ defaultLocale: "en", locales: null })
      .where(eq(page.id, testPageToUpdateId));
  });

  test("clears locales when field is omitted", async () => {
    // Set some locales
    await db
      .update(page)
      .set({ defaultLocale: "en", locales: ["en", "fr"] })
      .where(eq(page.id, testPageToUpdateId));

    // Omitting locales clears them (same as sending [])
    const res = await connectRequest(
      "UpdateStatusPage",
      {
        id: String(testPageToUpdateId),
        title: `${TEST_PREFIX}-no-locale-change`,
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.statusPage.locales ?? []).toEqual([]);

    // Restore defaults
    await db
      .update(page)
      .set({
        title: `${TEST_PREFIX}-page-to-update`,
        defaultLocale: "en",
        locales: null,
      })
      .where(eq(page.id, testPageToUpdateId));
  });

  test("resets locales to null when empty list is sent", async () => {
    // First set some locales
    await db
      .update(page)
      .set({ defaultLocale: "en", locales: ["en", "fr"] })
      .where(eq(page.id, testPageToUpdateId));

    // Send empty locales to clear them
    const res = await connectRequest(
      "UpdateStatusPage",
      {
        id: String(testPageToUpdateId),
        locales: [],
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.statusPage.locales ?? []).toEqual([]);

    // Restore defaults
    await db
      .update(page)
      .set({ defaultLocale: "en", locales: null })
      .where(eq(page.id, testPageToUpdateId));
  });
});

// ==========================================================================
// Locale Support
// ==========================================================================

describe("StatusPageService locale fields", () => {
  test("creates a page with locale settings", async () => {
    const res = await connectRequest(
      "CreateStatusPage",
      {
        title: `${TEST_PREFIX}-locale-create`,
        slug: `${TEST_PREFIX}-locale-create-slug`,
        defaultLocale: "LOCALE_DE",
        locales: ["LOCALE_EN", "LOCALE_DE"],
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.statusPage.defaultLocale).toBe("LOCALE_DE");
    expect(data.statusPage.locales).toEqual(["LOCALE_EN", "LOCALE_DE"]);

    // Clean up
    await db.delete(page).where(eq(page.id, Number(data.statusPage.id)));
  });

  test("creates a page with default locale when none specified", async () => {
    const res = await connectRequest(
      "CreateStatusPage",
      {
        title: `${TEST_PREFIX}-locale-default`,
        slug: `${TEST_PREFIX}-locale-default-slug`,
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.statusPage.defaultLocale).toBe("LOCALE_EN");
    // ConnectRPC omits empty repeated fields in JSON
    expect(data.statusPage.locales ?? []).toEqual([]);

    // Clean up
    await db.delete(page).where(eq(page.id, Number(data.statusPage.id)));
  });

  test("returns locale fields in GetStatusPage", async () => {
    // Set locale on test page
    await db
      .update(page)
      .set({ defaultLocale: "fr", locales: ["en", "fr"] })
      .where(eq(page.id, testPageId));

    const res = await connectRequest(
      "GetStatusPage",
      { id: String(testPageId) },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.statusPage.defaultLocale).toBe("LOCALE_FR");
    expect(data.statusPage.locales).toEqual(["LOCALE_EN", "LOCALE_FR"]);

    // Restore defaults
    await db
      .update(page)
      .set({ defaultLocale: "en", locales: null })
      .where(eq(page.id, testPageId));
  });

  test("returns locale fields in GetStatusPageContent", async () => {
    await db
      .update(page)
      .set({ defaultLocale: "de", locales: ["en", "de"] })
      .where(eq(page.id, testPageId));

    const res = await connectRequest(
      "GetStatusPageContent",
      { slug: testPageSlug },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.statusPage.defaultLocale).toBe("LOCALE_DE");
    expect(data.statusPage.locales).toEqual(["LOCALE_EN", "LOCALE_DE"]);

    // Restore defaults
    await db
      .update(page)
      .set({ defaultLocale: "en", locales: null })
      .where(eq(page.id, testPageId));
  });

  test("create returns 400 when defaultLocale is not in locales", async () => {
    const res = await connectRequest(
      "CreateStatusPage",
      {
        title: `${TEST_PREFIX}-locale-invalid`,
        slug: `${TEST_PREFIX}-locale-invalid-slug`,
        defaultLocale: "LOCALE_FR",
        locales: ["LOCALE_EN", "LOCALE_DE"],
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.message).toContain(
      "Default locale must be included in the locales list",
    );
  });

  test("update returns 400 when defaultLocale is not in locales", async () => {
    const res = await connectRequest(
      "UpdateStatusPage",
      {
        id: String(testPageToUpdateId),
        defaultLocale: "LOCALE_FR",
        locales: ["LOCALE_EN", "LOCALE_DE"],
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.message).toContain(
      "Default locale must be included in the locales list",
    );
  });

  test("create deduplicates locales", async () => {
    const res = await connectRequest(
      "CreateStatusPage",
      {
        title: `${TEST_PREFIX}-locale-dedup`,
        slug: `${TEST_PREFIX}-locale-dedup-slug`,
        defaultLocale: "LOCALE_EN",
        locales: ["LOCALE_EN", "LOCALE_EN", "LOCALE_DE"],
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.statusPage.locales).toEqual(["LOCALE_EN", "LOCALE_DE"]);

    // Clean up
    await db.delete(page).where(eq(page.id, Number(data.statusPage.id)));
  });

  test("update deduplicates locales", async () => {
    const res = await connectRequest(
      "UpdateStatusPage",
      {
        id: String(testPageToUpdateId),
        defaultLocale: "LOCALE_EN",
        locales: ["LOCALE_EN", "LOCALE_EN", "LOCALE_DE", "LOCALE_DE"],
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.statusPage.locales).toEqual(["LOCALE_EN", "LOCALE_DE"]);

    // Restore defaults
    await db
      .update(page)
      .set({ defaultLocale: "en", locales: null })
      .where(eq(page.id, testPageToUpdateId));
  });
});

// ==========================================================================
// i18n Plan Limits
// ==========================================================================

describe("StatusPageService i18n plan limits", () => {
  test("create rejects defaultLocale on free plan", async () => {
    const res = await connectRequest(
      "CreateStatusPage",
      {
        title: `${TEST_PREFIX}-i18n-limit-create`,
        slug: `${TEST_PREFIX}-i18n-limit-create-slug`,
        defaultLocale: "LOCALE_DE",
      },
      { "x-openstatus-key": "2" },
    );

    expect(res.status).toBe(403);

    const data = await res.json();
    expect(data.message).toContain("Upgrade to configure locales");
  });

  test("create rejects locales on free plan", async () => {
    const res = await connectRequest(
      "CreateStatusPage",
      {
        title: `${TEST_PREFIX}-i18n-limit-create`,
        slug: `${TEST_PREFIX}-i18n-limit-create-slug`,
        locales: ["LOCALE_EN", "LOCALE_FR"],
      },
      { "x-openstatus-key": "2" },
    );

    expect(res.status).toBe(403);

    const data = await res.json();
    expect(data.message).toContain("Upgrade to configure locales");
  });

  test("update rejects defaultLocale on free plan", async () => {
    // Create a page for workspace 2
    const testPage = await db
      .insert(page)
      .values({
        workspaceId: 2,
        title: `${TEST_PREFIX}-i18n-limit-update`,
        slug: `${TEST_PREFIX}-i18n-limit-update-slug`,
        description: "",
        customDomain: "",
      })
      .returning()
      .get();

    try {
      const res = await connectRequest(
        "UpdateStatusPage",
        {
          id: String(testPage.id),
          defaultLocale: "LOCALE_FR",
        },
        { "x-openstatus-key": "2" },
      );

      expect(res.status).toBe(403);

      const data = await res.json();
      expect(data.message).toContain("Upgrade to configure locales");
    } finally {
      await db.delete(page).where(eq(page.id, testPage.id));
    }
  });

  test("update rejects locales on free plan", async () => {
    // Create a page for workspace 2
    const testPage = await db
      .insert(page)
      .values({
        workspaceId: 2,
        title: `${TEST_PREFIX}-i18n-limit-update`,
        slug: `${TEST_PREFIX}-i18n-limit-update-slug`,
        description: "",
        customDomain: "",
      })
      .returning()
      .get();

    try {
      const res = await connectRequest(
        "UpdateStatusPage",
        {
          id: String(testPage.id),
          locales: ["LOCALE_EN", "LOCALE_FR"],
        },
        { "x-openstatus-key": "2" },
      );

      expect(res.status).toBe(403);

      const data = await res.json();
      expect(data.message).toContain("Upgrade to configure locales");
    } finally {
      await db.delete(page).where(eq(page.id, testPage.id));
    }
  });

  test("create allows locale settings on paid plan", async () => {
    const res = await connectRequest(
      "CreateStatusPage",
      {
        title: `${TEST_PREFIX}-i18n-limit-create`,
        slug: `${TEST_PREFIX}-i18n-limit-create-slug`,
        defaultLocale: "LOCALE_DE",
        locales: ["LOCALE_EN", "LOCALE_DE"],
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.statusPage.defaultLocale).toBe("LOCALE_DE");
    expect(data.statusPage.locales).toEqual(["LOCALE_EN", "LOCALE_DE"]);

    // Clean up
    await db.delete(page).where(eq(page.id, Number(data.statusPage.id)));
  });

  test("update allows locale settings on paid plan", async () => {
    const res = await connectRequest(
      "UpdateStatusPage",
      {
        id: String(testPageToUpdateId),
        defaultLocale: "LOCALE_FR",
        locales: ["LOCALE_EN", "LOCALE_FR"],
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.statusPage.defaultLocale).toBe("LOCALE_FR");
    expect(data.statusPage.locales).toEqual(["LOCALE_EN", "LOCALE_FR"]);

    // Restore defaults
    await db
      .update(page)
      .set({ defaultLocale: "en", locales: null })
      .where(eq(page.id, testPageToUpdateId));
  });
});

describe("StatusPageService.DeleteStatusPage", () => {
  test("successfully deletes existing status page", async () => {
    const res = await connectRequest(
      "DeleteStatusPage",
      { id: String(testPageToDeleteId) },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);

    // Verify it's deleted
    const deleted = await db
      .select()
      .from(page)
      .where(eq(page.id, testPageToDeleteId))
      .get();
    expect(deleted).toBeUndefined();
  });

  test("returns 401 when no auth key provided", async () => {
    const res = await connectRequest("DeleteStatusPage", { id: "1" });

    expect(res.status).toBe(401);
  });

  test("returns 404 for non-existent status page", async () => {
    const res = await connectRequest(
      "DeleteStatusPage",
      { id: "99999" },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(404);
  });
});

// ==========================================================================
// Component Management
// ==========================================================================

describe("StatusPageService.AddMonitorComponent", () => {
  test("adds monitor component to page", async () => {
    const res = await connectRequest(
      "AddMonitorComponent",
      {
        pageId: String(testPageId),
        monitorId: String(testMonitorId),
        name: `${TEST_PREFIX}-monitor-component`,
        order: 200,
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("component");
    expect(data.component.name).toBe(`${TEST_PREFIX}-monitor-component`);
    expect(data.component.type).toBe("PAGE_COMPONENT_TYPE_MONITOR");
    expect(data.component.monitorId).toBe(String(testMonitorId));

    // Clean up
    await db
      .delete(pageComponent)
      .where(eq(pageComponent.id, Number(data.component.id)));
  });

  test("returns 401 when no auth key provided", async () => {
    const res = await connectRequest("AddMonitorComponent", {
      pageId: String(testPageId),
      monitorId: String(testMonitorId),
    });

    expect(res.status).toBe(401);
  });

  test("returns 404 for non-existent page", async () => {
    const res = await connectRequest(
      "AddMonitorComponent",
      {
        pageId: "99999",
        monitorId: String(testMonitorId),
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(404);
  });

  test("returns 404 for non-existent monitor", async () => {
    const res = await connectRequest(
      "AddMonitorComponent",
      {
        pageId: String(testPageId),
        monitorId: "99999",
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(404);
  });

  test("adds component with group", async () => {
    const res = await connectRequest(
      "AddMonitorComponent",
      {
        pageId: String(testPageId),
        monitorId: String(testMonitorId),
        name: `${TEST_PREFIX}-monitor-component-grouped`,
        groupId: String(testGroupId),
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.component.groupId).toBe(String(testGroupId));

    // Clean up
    await db
      .delete(pageComponent)
      .where(eq(pageComponent.id, Number(data.component.id)));
  });

  test("returns 403 when page component limit is exceeded", async () => {
    // Workspace 2 is on free plan with page-components limit of 3
    // Create a page for workspace 2
    const limitTestPage = await db
      .insert(page)
      .values({
        workspaceId: 2,
        title: `${TEST_PREFIX}-component-limit-test`,
        slug: `${TEST_PREFIX}-component-limit-test-slug`,
        description: "Page for component limit test",
        customDomain: "",
      })
      .returning()
      .get();

    // Create a monitor for workspace 2
    const limitTestMonitor = await db
      .insert(monitor)
      .values({
        workspaceId: 2,
        name: `${TEST_PREFIX}-limit-monitor`,
        url: "https://example.com",
        periodicity: "1m",
        active: true,
        jobType: "http",
      })
      .returning()
      .get();

    // Create 3 components to hit the limit
    const createdComponentIds: number[] = [];
    for (let i = 0; i < 3; i++) {
      const component = await db
        .insert(pageComponent)
        .values({
          workspaceId: 2,
          pageId: limitTestPage.id,
          type: "static",
          name: `${TEST_PREFIX}-limit-component-${i}`,
          order: i,
        })
        .returning()
        .get();
      createdComponentIds.push(component.id);
    }

    try {
      // Try to add a 4th component - should fail with PermissionDenied
      const res = await connectRequest(
        "AddMonitorComponent",
        {
          pageId: String(limitTestPage.id),
          monitorId: String(limitTestMonitor.id),
          name: `${TEST_PREFIX}-limit-exceeded-component`,
        },
        { "x-openstatus-key": "2" },
      );

      expect(res.status).toBe(403); // PermissionDenied

      const data = await res.json();
      expect(data.message).toContain("Upgrade for more page components");
    } finally {
      // Clean up
      for (const id of createdComponentIds) {
        await db.delete(pageComponent).where(eq(pageComponent.id, id));
      }
      await db.delete(monitor).where(eq(monitor.id, limitTestMonitor.id));
      await db.delete(page).where(eq(page.id, limitTestPage.id));
    }
  });
});

describe("StatusPageService.AddStaticComponent", () => {
  test("adds static component to page", async () => {
    const res = await connectRequest(
      "AddStaticComponent",
      {
        pageId: String(testPageId),
        name: `${TEST_PREFIX}-static-component`,
        description: "Static service",
        order: 300,
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("component");
    expect(data.component.name).toBe(`${TEST_PREFIX}-static-component`);
    expect(data.component.type).toBe("PAGE_COMPONENT_TYPE_STATIC");
    expect(data.component.description).toBe("Static service");

    // Clean up
    await db
      .delete(pageComponent)
      .where(eq(pageComponent.id, Number(data.component.id)));
  });

  test("returns 401 when no auth key provided", async () => {
    const res = await connectRequest("AddStaticComponent", {
      pageId: String(testPageId),
      name: "Unauthorized component",
    });

    expect(res.status).toBe(401);
  });

  test("returns 404 for non-existent page", async () => {
    const res = await connectRequest(
      "AddStaticComponent",
      {
        pageId: "99999",
        name: "Component for non-existent page",
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(404);
  });

  test("returns 403 when page component limit is exceeded", async () => {
    // Workspace 2 is on free plan with page-components limit of 3
    // Create a page for workspace 2
    const limitTestPage = await db
      .insert(page)
      .values({
        workspaceId: 2,
        title: `${TEST_PREFIX}-static-limit-test`,
        slug: `${TEST_PREFIX}-static-limit-test-slug`,
        description: "Page for static component limit test",
        customDomain: "",
      })
      .returning()
      .get();

    // Create 3 components to hit the limit
    const createdComponentIds: number[] = [];
    for (let i = 0; i < 3; i++) {
      const component = await db
        .insert(pageComponent)
        .values({
          workspaceId: 2,
          pageId: limitTestPage.id,
          type: "static",
          name: `${TEST_PREFIX}-static-limit-component-${i}`,
          order: i,
        })
        .returning()
        .get();
      createdComponentIds.push(component.id);
    }

    try {
      // Try to add a 4th component - should fail with PermissionDenied
      const res = await connectRequest(
        "AddStaticComponent",
        {
          pageId: String(limitTestPage.id),
          name: `${TEST_PREFIX}-static-limit-exceeded`,
          description: "Should fail due to limit",
        },
        { "x-openstatus-key": "2" },
      );

      expect(res.status).toBe(403); // PermissionDenied

      const data = await res.json();
      expect(data.message).toContain("Upgrade for more page components");
    } finally {
      // Clean up
      for (const id of createdComponentIds) {
        await db.delete(pageComponent).where(eq(pageComponent.id, id));
      }
      await db.delete(page).where(eq(page.id, limitTestPage.id));
    }
  });
});

describe("StatusPageService.RemoveComponent", () => {
  test("successfully removes component", async () => {
    const res = await connectRequest(
      "RemoveComponent",
      { id: String(testComponentToDeleteId) },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);

    // Verify it's deleted
    const deleted = await db
      .select()
      .from(pageComponent)
      .where(eq(pageComponent.id, testComponentToDeleteId))
      .get();
    expect(deleted).toBeUndefined();
  });

  test("returns 401 when no auth key provided", async () => {
    const res = await connectRequest("RemoveComponent", { id: "1" });

    expect(res.status).toBe(401);
  });

  test("returns 404 for non-existent component", async () => {
    const res = await connectRequest(
      "RemoveComponent",
      { id: "99999" },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(404);
  });
});

describe("StatusPageService.UpdateComponent", () => {
  test("updates component name", async () => {
    const res = await connectRequest(
      "UpdateComponent",
      {
        id: String(testComponentToUpdateId),
        name: `${TEST_PREFIX}-component-updated`,
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("component");
    expect(data.component.name).toBe(`${TEST_PREFIX}-component-updated`);

    // Restore original name
    await db
      .update(pageComponent)
      .set({ name: `${TEST_PREFIX}-component-to-update` })
      .where(eq(pageComponent.id, testComponentToUpdateId));
  });

  test("updates component group", async () => {
    const res = await connectRequest(
      "UpdateComponent",
      {
        id: String(testComponentToUpdateId),
        groupId: String(testGroupId),
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.component.groupId).toBe(String(testGroupId));

    // Remove from group
    await db
      .update(pageComponent)
      .set({ groupId: null })
      .where(eq(pageComponent.id, testComponentToUpdateId));
  });

  test("returns 401 when no auth key provided", async () => {
    const res = await connectRequest("UpdateComponent", {
      id: String(testComponentToUpdateId),
      name: "Unauthorized update",
    });

    expect(res.status).toBe(401);
  });

  test("returns 404 for non-existent component", async () => {
    const res = await connectRequest(
      "UpdateComponent",
      { id: "99999", name: "Non-existent update" },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(404);
  });

  test("returns 404 for non-existent group", async () => {
    const res = await connectRequest(
      "UpdateComponent",
      {
        id: String(testComponentToUpdateId),
        groupId: "99999",
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(404);
  });
});

// ==========================================================================
// Component Groups
// ==========================================================================

describe("StatusPageService.CreateComponentGroup", () => {
  test("creates a new component group", async () => {
    const res = await connectRequest(
      "CreateComponentGroup",
      {
        pageId: String(testPageId),
        name: `${TEST_PREFIX}-new-group`,
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("group");
    expect(data.group.name).toBe(`${TEST_PREFIX}-new-group`);
    expect(data.group.pageId).toBe(String(testPageId));

    // Clean up
    await db
      .delete(pageComponentGroup)
      .where(eq(pageComponentGroup.id, Number(data.group.id)));
  });

  test("creates a component group with defaultOpen true", async () => {
    const res = await connectRequest(
      "CreateComponentGroup",
      {
        pageId: String(testPageId),
        name: `${TEST_PREFIX}-open-group`,
        defaultOpen: true,
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("group");
    expect(data.group.name).toBe(`${TEST_PREFIX}-open-group`);
    expect(data.group.defaultOpen).toBe(true);

    // Verify persisted in DB
    const dbGroup = await db
      .select()
      .from(pageComponentGroup)
      .where(eq(pageComponentGroup.id, Number(data.group.id)))
      .get();
    expect(dbGroup?.defaultOpen).toBe(true);

    // Clean up
    await db
      .delete(pageComponentGroup)
      .where(eq(pageComponentGroup.id, Number(data.group.id)));
  });

  test("returns 401 when no auth key provided", async () => {
    const res = await connectRequest("CreateComponentGroup", {
      pageId: String(testPageId),
      name: "Unauthorized group",
    });

    expect(res.status).toBe(401);
  });

  test("returns 404 for non-existent page", async () => {
    const res = await connectRequest(
      "CreateComponentGroup",
      {
        pageId: "99999",
        name: "Group for non-existent page",
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(404);
  });
});

describe("StatusPageService.DeleteComponentGroup", () => {
  test("successfully deletes component group", async () => {
    const res = await connectRequest(
      "DeleteComponentGroup",
      { id: String(testGroupToDeleteId) },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);

    // Verify it's deleted
    const deleted = await db
      .select()
      .from(pageComponentGroup)
      .where(eq(pageComponentGroup.id, testGroupToDeleteId))
      .get();
    expect(deleted).toBeUndefined();
  });

  test("returns 401 when no auth key provided", async () => {
    const res = await connectRequest("DeleteComponentGroup", { id: "1" });

    expect(res.status).toBe(401);
  });

  test("returns 404 for non-existent group", async () => {
    const res = await connectRequest(
      "DeleteComponentGroup",
      { id: "99999" },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(404);
  });
});

describe("StatusPageService.UpdateComponentGroup", () => {
  test("updates component group name", async () => {
    const res = await connectRequest(
      "UpdateComponentGroup",
      {
        id: String(testGroupToUpdateId),
        name: `${TEST_PREFIX}-group-updated`,
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("group");
    expect(data.group.name).toBe(`${TEST_PREFIX}-group-updated`);

    // Restore original name
    await db
      .update(pageComponentGroup)
      .set({ name: `${TEST_PREFIX}-group-to-update` })
      .where(eq(pageComponentGroup.id, testGroupToUpdateId));
  });

  test("updates component group defaultOpen to true", async () => {
    const res = await connectRequest(
      "UpdateComponentGroup",
      {
        id: String(testGroupToUpdateId),
        defaultOpen: true,
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("group");
    expect(data.group.defaultOpen).toBe(true);

    // Verify persisted in DB
    const dbGroup = await db
      .select()
      .from(pageComponentGroup)
      .where(eq(pageComponentGroup.id, testGroupToUpdateId))
      .get();
    expect(dbGroup?.defaultOpen).toBe(true);

    // Restore original value
    await db
      .update(pageComponentGroup)
      .set({ defaultOpen: false })
      .where(eq(pageComponentGroup.id, testGroupToUpdateId));
  });

  test("returns 401 when no auth key provided", async () => {
    const res = await connectRequest("UpdateComponentGroup", {
      id: String(testGroupToUpdateId),
      name: "Unauthorized update",
    });

    expect(res.status).toBe(401);
  });

  test("returns 404 for non-existent group", async () => {
    const res = await connectRequest(
      "UpdateComponentGroup",
      { id: "99999", name: "Non-existent update" },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(404);
  });
});

// ==========================================================================
// Subscribers
// ==========================================================================

describe("StatusPageService.SubscribeToPage", () => {
  test("subscribes new user to page", async () => {
    const res = await connectRequest(
      "SubscribeToPage",
      {
        pageId: String(testPageId),
        email: `${TEST_PREFIX}-subscribe@example.com`,
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("subscriber");
    expect(data.subscriber.email).toBe(`${TEST_PREFIX}-subscribe@example.com`);
    expect(data.subscriber.pageId).toBe(String(testPageId));

    // Clean up
    await db
      .delete(pageSubscriber)
      .where(eq(pageSubscriber.id, Number(data.subscriber.id)));
  });

  test("returns existing subscriber when already subscribed", async () => {
    const res = await connectRequest(
      "SubscribeToPage",
      {
        pageId: String(testPageId),
        email: `${TEST_PREFIX}@example.com`, // Already exists
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("subscriber");
    expect(data.subscriber.id).toBe(String(testSubscriberId));
  });

  test("returns 401 when no auth key provided", async () => {
    const res = await connectRequest("SubscribeToPage", {
      pageId: String(testPageId),
      email: "unauthorized@example.com",
    });

    expect(res.status).toBe(401);
  });

  test("returns 404 for non-existent page", async () => {
    const res = await connectRequest(
      "SubscribeToPage",
      {
        pageId: "99999",
        email: "test@example.com",
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(404);
  });
});

describe("StatusPageService.UnsubscribeFromPage", () => {
  test("unsubscribes by email", async () => {
    // First subscribe a new user
    const subscribeRes = await connectRequest(
      "SubscribeToPage",
      {
        pageId: String(testPageId),
        email: `${TEST_PREFIX}-unsub-email@example.com`,
      },
      { "x-openstatus-key": "1" },
    );
    const subscribeData = await subscribeRes.json();

    // Then unsubscribe
    const res = await connectRequest(
      "UnsubscribeFromPage",
      {
        pageId: String(testPageId),
        email: `${TEST_PREFIX}-unsub-email@example.com`,
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);

    // Verify unsubscribedAt is set
    const subscriber = await db
      .select()
      .from(pageSubscriber)
      .where(eq(pageSubscriber.id, Number(subscribeData.subscriber.id)))
      .get();
    expect(subscriber?.unsubscribedAt).not.toBeNull();

    // Clean up
    await db
      .delete(pageSubscriber)
      .where(eq(pageSubscriber.id, Number(subscribeData.subscriber.id)));
  });

  test("unsubscribes by id", async () => {
    // First subscribe a new user
    const subscribeRes = await connectRequest(
      "SubscribeToPage",
      {
        pageId: String(testPageId),
        email: `${TEST_PREFIX}-unsub-id@example.com`,
      },
      { "x-openstatus-key": "1" },
    );
    const subscribeData = await subscribeRes.json();

    // Then unsubscribe by id
    const res = await connectRequest(
      "UnsubscribeFromPage",
      {
        pageId: String(testPageId),
        id: subscribeData.subscriber.id,
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);

    // Clean up
    await db
      .delete(pageSubscriber)
      .where(eq(pageSubscriber.id, Number(subscribeData.subscriber.id)));
  });

  test("returns 401 when no auth key provided", async () => {
    const res = await connectRequest("UnsubscribeFromPage", {
      pageId: String(testPageId),
      email: "test@example.com",
    });

    expect(res.status).toBe(401);
  });

  test("returns 404 for non-existent subscriber", async () => {
    const res = await connectRequest(
      "UnsubscribeFromPage",
      {
        pageId: String(testPageId),
        email: "nonexistent@example.com",
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(404);
  });

  test("returns error when no identifier provided", async () => {
    const res = await connectRequest(
      "UnsubscribeFromPage",
      {
        pageId: String(testPageId),
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(400);
  });
});

describe("StatusPageService.ListSubscribers", () => {
  test("returns subscribers for page", async () => {
    const res = await connectRequest(
      "ListSubscribers",
      { pageId: String(testPageId) },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("subscribers");
    expect(Array.isArray(data.subscribers)).toBe(true);
    expect(data).toHaveProperty("totalSize");
  });

  test("returns 401 when no auth key provided", async () => {
    const res = await connectRequest("ListSubscribers", {
      pageId: String(testPageId),
    });

    expect(res.status).toBe(401);
  });

  test("returns 404 for non-existent page", async () => {
    const res = await connectRequest(
      "ListSubscribers",
      { pageId: "99999" },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(404);
  });

  test("filters out unsubscribed by default", async () => {
    // Create an unsubscribed subscriber
    const unsubscriber = await db
      .insert(pageSubscriber)
      .values({
        pageId: testPageId,
        email: `${TEST_PREFIX}-unsubbed@example.com`,
        token: `${TEST_PREFIX}-unsubbed-token`,
        unsubscribedAt: new Date(),
      })
      .returning()
      .get();

    try {
      const res = await connectRequest(
        "ListSubscribers",
        { pageId: String(testPageId) },
        { "x-openstatus-key": "1" },
      );

      expect(res.status).toBe(200);

      const data = await res.json();
      const subscriberEmails = (data.subscribers || []).map(
        (s: { email: string }) => s.email,
      );
      expect(subscriberEmails).not.toContain(
        `${TEST_PREFIX}-unsubbed@example.com`,
      );
    } finally {
      await db
        .delete(pageSubscriber)
        .where(eq(pageSubscriber.id, unsubscriber.id));
    }
  });

  test("includes unsubscribed when flag is true", async () => {
    // Create an unsubscribed subscriber
    const unsubscriber = await db
      .insert(pageSubscriber)
      .values({
        pageId: testPageId,
        email: `${TEST_PREFIX}-unsubbed2@example.com`,
        token: `${TEST_PREFIX}-unsubbed2-token`,
        unsubscribedAt: new Date(),
      })
      .returning()
      .get();

    try {
      const res = await connectRequest(
        "ListSubscribers",
        { pageId: String(testPageId), includeUnsubscribed: true },
        { "x-openstatus-key": "1" },
      );

      expect(res.status).toBe(200);

      const data = await res.json();
      const subscriberEmails = (data.subscribers || []).map(
        (s: { email: string }) => s.email,
      );
      expect(subscriberEmails).toContain(
        `${TEST_PREFIX}-unsubbed2@example.com`,
      );
    } finally {
      await db
        .delete(pageSubscriber)
        .where(eq(pageSubscriber.id, unsubscriber.id));
    }
  });
});

// ==========================================================================
// Full Content & Status
// ==========================================================================

describe("StatusPageService.GetStatusPageContent", () => {
  test("returns full content by ID", async () => {
    const res = await connectRequest(
      "GetStatusPageContent",
      { id: String(testPageId) },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("statusPage");
    expect(data).toHaveProperty("components");
    expect(data).toHaveProperty("groups");
    // statusReports may be undefined/empty if there are no active reports
    expect(data.statusPage.id).toBe(String(testPageId));
  });

  test("returns full content by slug", async () => {
    const res = await connectRequest(
      "GetStatusPageContent",
      { slug: testPageSlug },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("statusPage");
    expect(data.statusPage.slug).toBe(testPageSlug);
  });

  test("returns defaultOpen for component groups", async () => {
    // Create a group with defaultOpen true
    const group = await db
      .insert(pageComponentGroup)
      .values({
        workspaceId: 1,
        pageId: testPageId,
        name: `${TEST_PREFIX}-default-open-group`,
        defaultOpen: true,
      })
      .returning()
      .get();

    try {
      const res = await connectRequest(
        "GetStatusPageContent",
        { id: String(testPageId) },
        { "x-openstatus-key": "1" },
      );

      expect(res.status).toBe(200);

      const data = await res.json();
      const openGroup = data.groups.find(
        (g: { id: string }) => g.id === String(group.id),
      );
      expect(openGroup).toBeDefined();
      expect(openGroup.defaultOpen).toBe(true);
    } finally {
      await db
        .delete(pageComponentGroup)
        .where(eq(pageComponentGroup.id, group.id));
    }
  });

  test("returns 401 when no auth key provided", async () => {
    const res = await connectRequest("GetStatusPageContent", {
      id: String(testPageId),
    });

    expect(res.status).toBe(401);
  });

  test("returns 404 for non-existent page", async () => {
    const res = await connectRequest(
      "GetStatusPageContent",
      { id: "99999" },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(404);
  });

  test("returns 404 for unpublished page accessed by slug", async () => {
    // Create an unpublished page
    const unpublishedPage = await db
      .insert(page)
      .values({
        workspaceId: 1,
        title: `${TEST_PREFIX}-unpublished`,
        slug: `${TEST_PREFIX}-unpublished-slug`,
        description: "Unpublished page",
        customDomain: "",
        published: false,
        accessType: "public",
      })
      .returning()
      .get();

    try {
      const res = await connectRequest(
        "GetStatusPageContent",
        { slug: unpublishedPage.slug },
        { "x-openstatus-key": "1" },
      );

      expect(res.status).toBe(404);
    } finally {
      await db.delete(page).where(eq(page.id, unpublishedPage.id));
    }
  });

  test("returns 403 for password-protected page accessed by slug", async () => {
    // Create a password-protected page
    const protectedPage = await db
      .insert(page)
      .values({
        workspaceId: 1,
        title: `${TEST_PREFIX}-protected`,
        slug: `${TEST_PREFIX}-protected-slug`,
        description: "Password protected page",
        customDomain: "",
        published: true,
        accessType: "password",
      })
      .returning()
      .get();

    try {
      const res = await connectRequest(
        "GetStatusPageContent",
        { slug: protectedPage.slug },
        { "x-openstatus-key": "1" },
      );

      expect(res.status).toBe(403);
    } finally {
      await db.delete(page).where(eq(page.id, protectedPage.id));
    }
  });

  test("allows workspace owner to access unpublished page by ID", async () => {
    // Create an unpublished page
    const unpublishedPage = await db
      .insert(page)
      .values({
        workspaceId: 1,
        title: `${TEST_PREFIX}-unpublished-by-id`,
        slug: `${TEST_PREFIX}-unpublished-by-id-slug`,
        description: "Unpublished page accessible by ID",
        customDomain: "",
        published: false,
        accessType: "public",
      })
      .returning()
      .get();

    try {
      const res = await connectRequest(
        "GetStatusPageContent",
        { id: String(unpublishedPage.id) },
        { "x-openstatus-key": "1" },
      );

      // Workspace owner can access their own unpublished pages by ID
      expect(res.status).toBe(200);
    } finally {
      await db.delete(page).where(eq(page.id, unpublishedPage.id));
    }
  });

  test("includes active status reports", async () => {
    // Create an active status report for the test page
    const report = await db
      .insert(statusReport)
      .values({
        workspaceId: 1,
        pageId: testPageId,
        title: `${TEST_PREFIX}-active-report`,
        status: "investigating",
      })
      .returning()
      .get();

    await db.insert(statusReportsToPageComponents).values({
      statusReportId: report.id,
      pageComponentId: testComponentId,
    });

    try {
      const res = await connectRequest(
        "GetStatusPageContent",
        { id: String(testPageId) },
        { "x-openstatus-key": "1" },
      );

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.statusReports.length).toBeGreaterThan(0);

      const testReport = data.statusReports.find(
        (r: { title: string }) => r.title === `${TEST_PREFIX}-active-report`,
      );
      expect(testReport).toBeDefined();
    } finally {
      await db
        .delete(statusReportsToPageComponents)
        .where(eq(statusReportsToPageComponents.statusReportId, report.id));
      await db.delete(statusReport).where(eq(statusReport.id, report.id));
    }
  });
});

describe("StatusPageService.GetOverallStatus", () => {
  test("returns overall status by ID", async () => {
    const res = await connectRequest(
      "GetOverallStatus",
      { id: String(testPageId) },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("overallStatus");
    expect(data).toHaveProperty("componentStatuses");
  });

  test("returns overall status by slug", async () => {
    const res = await connectRequest(
      "GetOverallStatus",
      { slug: testPageSlug },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("overallStatus");
  });

  test("returns 401 when no auth key provided", async () => {
    const res = await connectRequest("GetOverallStatus", {
      id: String(testPageId),
    });

    expect(res.status).toBe(401);
  });

  test("returns 404 for non-existent page", async () => {
    const res = await connectRequest(
      "GetOverallStatus",
      { id: "99999" },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(404);
  });

  test("returns degraded status when there are active incidents", async () => {
    // Create an active status report for the test page
    const report = await db
      .insert(statusReport)
      .values({
        workspaceId: 1,
        pageId: testPageId,
        title: `${TEST_PREFIX}-incident-report`,
        status: "investigating",
      })
      .returning()
      .get();

    await db.insert(statusReportsToPageComponents).values({
      statusReportId: report.id,
      pageComponentId: testComponentId,
    });

    try {
      const res = await connectRequest(
        "GetOverallStatus",
        { id: String(testPageId) },
        { "x-openstatus-key": "1" },
      );

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.overallStatus).toBe("OVERALL_STATUS_DEGRADED");
    } finally {
      await db
        .delete(statusReportsToPageComponents)
        .where(eq(statusReportsToPageComponents.statusReportId, report.id));
      await db.delete(statusReport).where(eq(statusReport.id, report.id));
    }
  });
});

// ==========================================================================
// New Fields: icon, custom_domain, theme, access_type, password, auth_email_domains
// ==========================================================================

describe("StatusPageService.CreateStatusPage — new fields", () => {
  test("creates a page with icon", async () => {
    const res = await connectRequest(
      "CreateStatusPage",
      {
        title: `${TEST_PREFIX}-icon`,
        slug: `${TEST_PREFIX}-icon-slug`,
        icon: "https://example.com/my-icon.png",
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.statusPage.icon).toBe("https://example.com/my-icon.png");

    await db.delete(page).where(eq(page.id, Number(data.statusPage.id)));
  });

  test("creates a page with custom_domain", async () => {
    const res = await connectRequest(
      "CreateStatusPage",
      {
        title: `${TEST_PREFIX}-domain`,
        slug: `${TEST_PREFIX}-domain-slug`,
        customDomain: "status.example.com",
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.statusPage.customDomain).toBe("status.example.com");

    await db.delete(page).where(eq(page.id, Number(data.statusPage.id)));
  });

  test("creates a page with theme", async () => {
    const res = await connectRequest(
      "CreateStatusPage",
      {
        title: `${TEST_PREFIX}-theme`,
        slug: `${TEST_PREFIX}-theme-slug`,
        theme: "PAGE_THEME_DARK",
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.statusPage.theme).toBe("PAGE_THEME_DARK");

    await db.delete(page).where(eq(page.id, Number(data.statusPage.id)));
  });

  test("creates a page with access_type PASSWORD_PROTECTED + password", async () => {
    const res = await connectRequest(
      "CreateStatusPage",
      {
        title: `${TEST_PREFIX}-pw-create`,
        slug: `${TEST_PREFIX}-pw-create-slug`,
        accessType: "PAGE_ACCESS_TYPE_PASSWORD_PROTECTED",
        password: "my-secret",
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.statusPage.accessType).toBe(
      "PAGE_ACCESS_TYPE_PASSWORD_PROTECTED",
    );
    expect(data.statusPage.password).toBe("my-secret");

    await db.delete(page).where(eq(page.id, Number(data.statusPage.id)));
  });

  test("creates a page with access_type AUTHENTICATED + auth_email_domains", async () => {
    const res = await connectRequest(
      "CreateStatusPage",
      {
        title: `${TEST_PREFIX}-auth-create`,
        slug: `${TEST_PREFIX}-auth-create-slug`,
        accessType: "PAGE_ACCESS_TYPE_AUTHENTICATED",
        authEmailDomains: ["example.com", "test.com"],
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.statusPage.accessType).toBe("PAGE_ACCESS_TYPE_AUTHENTICATED");
    expect(data.statusPage.authEmailDomains).toEqual([
      "example.com",
      "test.com",
    ]);

    await db.delete(page).where(eq(page.id, Number(data.statusPage.id)));
  });

  test("returns 400 when PASSWORD_PROTECTED without password", async () => {
    const res = await connectRequest(
      "CreateStatusPage",
      {
        title: `${TEST_PREFIX}-no-pw`,
        slug: `${TEST_PREFIX}-no-pw-slug`,
        accessType: "PAGE_ACCESS_TYPE_PASSWORD_PROTECTED",
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.message).toContain("Password is required");
  });

  test("returns 400 when AUTHENTICATED without auth_email_domains", async () => {
    const res = await connectRequest(
      "CreateStatusPage",
      {
        title: `${TEST_PREFIX}-no-domains`,
        slug: `${TEST_PREFIX}-no-domains-slug`,
        accessType: "PAGE_ACCESS_TYPE_AUTHENTICATED",
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.message).toContain("At least one email domain is required");
  });

  test("returns 400 when custom_domain contains openstatus", async () => {
    const res = await connectRequest(
      "CreateStatusPage",
      {
        title: `${TEST_PREFIX}-bad-domain`,
        slug: `${TEST_PREFIX}-bad-domain-slug`,
        customDomain: "my-openstatus-page.com",
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(400);
  });

  test("returns 400 when custom_domain starts with http://", async () => {
    const res = await connectRequest(
      "CreateStatusPage",
      {
        title: `${TEST_PREFIX}-http-domain`,
        slug: `${TEST_PREFIX}-http-domain-slug`,
        customDomain: "http://status.example.com",
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(400);
  });

  test("returns 400 when icon is not a valid URL", async () => {
    const res = await connectRequest(
      "CreateStatusPage",
      {
        title: `${TEST_PREFIX}-bad-icon`,
        slug: `${TEST_PREFIX}-bad-icon-slug`,
        icon: "not-a-url",
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(400);
  });

  test("silently ignores password when access_type is PUBLIC", async () => {
    const res = await connectRequest(
      "CreateStatusPage",
      {
        title: `${TEST_PREFIX}-public-pw`,
        slug: `${TEST_PREFIX}-public-pw-slug`,
        accessType: "PAGE_ACCESS_TYPE_PUBLIC",
        password: "should-be-ignored",
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.statusPage.password ?? "").toBe("");

    await db.delete(page).where(eq(page.id, Number(data.statusPage.id)));
  });
});

describe("StatusPageService.UpdateStatusPage — new fields", () => {
  test("updates icon", async () => {
    const res = await connectRequest(
      "UpdateStatusPage",
      {
        id: String(testPasswordPageId),
        icon: "https://example.com/new-icon.png",
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.statusPage.icon).toBe("https://example.com/new-icon.png");

    await db
      .update(page)
      .set({ icon: "https://example.com/icon.png" })
      .where(eq(page.id, testPasswordPageId));
  });

  test("updates custom_domain", async () => {
    const res = await connectRequest(
      "UpdateStatusPage",
      {
        id: String(testPasswordPageId),
        customDomain: "status.mysite.com",
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.statusPage.customDomain).toBe("status.mysite.com");

    await db
      .update(page)
      .set({ customDomain: "" })
      .where(eq(page.id, testPasswordPageId));
  });

  test("updates theme", async () => {
    const res = await connectRequest(
      "UpdateStatusPage",
      {
        id: String(testPasswordPageId),
        theme: "PAGE_THEME_LIGHT",
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.statusPage.theme).toBe("PAGE_THEME_LIGHT");

    await db
      .update(page)
      .set({ forceTheme: "system" })
      .where(eq(page.id, testPasswordPageId));
  });

  test("updates access_type to PASSWORD_PROTECTED with password", async () => {
    await db
      .update(page)
      .set({ accessType: "public", password: null })
      .where(eq(page.id, testPasswordPageId));

    const res = await connectRequest(
      "UpdateStatusPage",
      {
        id: String(testPasswordPageId),
        accessType: "PAGE_ACCESS_TYPE_PASSWORD_PROTECTED",
        password: "new-secret",
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.statusPage.accessType).toBe(
      "PAGE_ACCESS_TYPE_PASSWORD_PROTECTED",
    );
    expect(data.statusPage.password).toBe("new-secret");

    await db
      .update(page)
      .set({ accessType: "password", password: "test-secret-123" })
      .where(eq(page.id, testPasswordPageId));
  });

  test("updates access_type to AUTHENTICATED with auth_email_domains", async () => {
    await db
      .update(page)
      .set({ accessType: "public", password: null, authEmailDomains: null })
      .where(eq(page.id, testPasswordPageId));

    const res = await connectRequest(
      "UpdateStatusPage",
      {
        id: String(testPasswordPageId),
        accessType: "PAGE_ACCESS_TYPE_AUTHENTICATED",
        authEmailDomains: ["mycompany.com"],
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.statusPage.accessType).toBe("PAGE_ACCESS_TYPE_AUTHENTICATED");
    expect(data.statusPage.authEmailDomains).toEqual(["mycompany.com"]);

    await db
      .update(page)
      .set({
        accessType: "password",
        password: "test-secret-123",
        authEmailDomains: null,
      })
      .where(eq(page.id, testPasswordPageId));
  });

  test("returns 400 when PASSWORD_PROTECTED without password", async () => {
    const res = await connectRequest(
      "UpdateStatusPage",
      {
        id: String(testPasswordPageId),
        accessType: "PAGE_ACCESS_TYPE_PASSWORD_PROTECTED",
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(400);
  });

  test("returns 400 when AUTHENTICATED without auth_email_domains", async () => {
    const res = await connectRequest(
      "UpdateStatusPage",
      {
        id: String(testPasswordPageId),
        accessType: "PAGE_ACCESS_TYPE_AUTHENTICATED",
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(400);
  });

  test("changing only title on password page succeeds without re-validation", async () => {
    const res = await connectRequest(
      "UpdateStatusPage",
      {
        id: String(testPasswordPageId),
        title: `${TEST_PREFIX}-title-only-change`,
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.statusPage.title).toBe(`${TEST_PREFIX}-title-only-change`);
    expect(data.statusPage.password).toBe("test-secret-123");

    await db
      .update(page)
      .set({ title: `${TEST_PREFIX}-password-page` })
      .where(eq(page.id, testPasswordPageId));
  });

  test("returns 400 when custom_domain contains openstatus", async () => {
    const res = await connectRequest(
      "UpdateStatusPage",
      {
        id: String(testPasswordPageId),
        customDomain: "openstatus-status.com",
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(400);
  });

  test("switching from PASSWORD_PROTECTED to PUBLIC clears password", async () => {
    await db
      .update(page)
      .set({ accessType: "password", password: "will-be-cleared" })
      .where(eq(page.id, testPasswordPageId));

    const res = await connectRequest(
      "UpdateStatusPage",
      {
        id: String(testPasswordPageId),
        accessType: "PAGE_ACCESS_TYPE_PUBLIC",
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.statusPage.accessType).toBe("PAGE_ACCESS_TYPE_PUBLIC");
    expect(data.statusPage.password ?? "").toBe("");

    await db
      .update(page)
      .set({ accessType: "password", password: "test-secret-123" })
      .where(eq(page.id, testPasswordPageId));
  });

  test("switching from AUTHENTICATED to PUBLIC clears auth_email_domains", async () => {
    await db
      .update(page)
      .set({
        accessType: "email-domain",
        authEmailDomains: "example.com,test.com",
        password: null,
      })
      .where(eq(page.id, testPasswordPageId));

    const res = await connectRequest(
      "UpdateStatusPage",
      {
        id: String(testPasswordPageId),
        accessType: "PAGE_ACCESS_TYPE_PUBLIC",
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.statusPage.accessType).toBe("PAGE_ACCESS_TYPE_PUBLIC");
    expect(data.statusPage.authEmailDomains ?? []).toEqual([]);

    await db
      .update(page)
      .set({
        accessType: "password",
        password: "test-secret-123",
        authEmailDomains: null,
      })
      .where(eq(page.id, testPasswordPageId));
  });

  test("clearing custom_domain with empty string succeeds", async () => {
    await db
      .update(page)
      .set({ customDomain: "status.example.com" })
      .where(eq(page.id, testPasswordPageId));

    const res = await connectRequest(
      "UpdateStatusPage",
      {
        id: String(testPasswordPageId),
        customDomain: "",
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.statusPage.customDomain ?? "").toBe("");
  });

  test("returns 400 when icon is not a valid URL", async () => {
    const res = await connectRequest(
      "UpdateStatusPage",
      {
        id: String(testPasswordPageId),
        icon: "not-a-url",
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(400);
  });
});

describe("StatusPageService — new fields limit enforcement (workspace 2 / free plan)", () => {
  let ws2PageId: number;

  test("returns 403 when creating with custom_domain on free plan", async () => {
    const res = await connectRequest(
      "CreateStatusPage",
      {
        title: `${TEST_PREFIX}-limit-ws2`,
        slug: `${TEST_PREFIX}-limit-ws2-slug`,
        customDomain: "status.freeplan.com",
      },
      { "x-openstatus-key": "2" },
    );

    expect(res.status).toBe(403);
  });

  test("returns 403 when creating with PASSWORD_PROTECTED on free plan", async () => {
    const res = await connectRequest(
      "CreateStatusPage",
      {
        title: `${TEST_PREFIX}-limit-ws2-pw`,
        slug: `${TEST_PREFIX}-limit-ws2-pw-slug`,
        accessType: "PAGE_ACCESS_TYPE_PASSWORD_PROTECTED",
        password: "secret",
      },
      { "x-openstatus-key": "2" },
    );

    expect(res.status).toBe(403);
  });

  test("returns 403 when creating with AUTHENTICATED on free plan", async () => {
    const res = await connectRequest(
      "CreateStatusPage",
      {
        title: `${TEST_PREFIX}-limit-ws2-auth`,
        slug: `${TEST_PREFIX}-limit-ws2-auth-slug`,
        accessType: "PAGE_ACCESS_TYPE_AUTHENTICATED",
        authEmailDomains: ["example.com"],
      },
      { "x-openstatus-key": "2" },
    );

    expect(res.status).toBe(403);
  });

  test("returns 403 when updating with custom_domain on free plan", async () => {
    const ws2Page = await db
      .insert(page)
      .values({
        workspaceId: 2,
        title: `${TEST_PREFIX}-limit-update-ws2`,
        slug: `${TEST_PREFIX}-limit-update-ws2-slug`,
        description: "Free plan page",
        customDomain: "",
      })
      .returning()
      .get();
    ws2PageId = ws2Page.id;

    const res = await connectRequest(
      "UpdateStatusPage",
      {
        id: String(ws2PageId),
        customDomain: "status.freeplan.com",
      },
      { "x-openstatus-key": "2" },
    );

    expect(res.status).toBe(403);
  });

  test("returns 403 when updating with PASSWORD_PROTECTED on free plan", async () => {
    const res = await connectRequest(
      "UpdateStatusPage",
      {
        id: String(ws2PageId),
        accessType: "PAGE_ACCESS_TYPE_PASSWORD_PROTECTED",
        password: "secret",
      },
      { "x-openstatus-key": "2" },
    );

    expect(res.status).toBe(403);
  });

  test("returns 403 when updating with AUTHENTICATED on free plan", async () => {
    const res = await connectRequest(
      "UpdateStatusPage",
      {
        id: String(ws2PageId),
        accessType: "PAGE_ACCESS_TYPE_AUTHENTICATED",
        authEmailDomains: ["example.com"],
      },
      { "x-openstatus-key": "2" },
    );

    expect(res.status).toBe(403);

    await db.delete(page).where(eq(page.id, ws2PageId));
  });
});

describe("StatusPageService — new fields in read responses", () => {
  test("GetStatusPage returns password and auth_email_domains", async () => {
    const res = await connectRequest(
      "GetStatusPage",
      { id: String(testPasswordPageId) },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.statusPage.password).toBe("test-secret-123");
    expect(data.statusPage.icon).toBe("https://example.com/icon.png");
  });

  test("GetStatusPageContent by slug does NOT return password", async () => {
    // Temporarily set to public so slug access works (validatePublicAccess requires public)
    await db
      .update(page)
      .set({ accessType: "public" })
      .where(eq(page.id, testPasswordPageId));

    const res = await connectRequest(
      "GetStatusPageContent",
      { slug: testPasswordPageSlug },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.statusPage.password ?? "").toBe("");
    expect(data.statusPage.icon).toBe("https://example.com/icon.png");

    // Restore
    await db
      .update(page)
      .set({ accessType: "password" })
      .where(eq(page.id, testPasswordPageId));
  });

  test("GetStatusPageContent by ID returns password", async () => {
    const res = await connectRequest(
      "GetStatusPageContent",
      { id: String(testPasswordPageId) },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.statusPage.password).toBe("test-secret-123");
  });

  test("GetStatusPageContent by slug redacts authEmailDomains", async () => {
    // Set page to public with stale authEmailDomains
    await db
      .update(page)
      .set({
        accessType: "public",
        authEmailDomains: "stale.com,leftover.com",
        password: null,
      })
      .where(eq(page.id, testPasswordPageId));

    const res = await connectRequest(
      "GetStatusPageContent",
      { slug: testPasswordPageSlug },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.statusPage.authEmailDomains ?? []).toEqual([]);

    // Restore
    await db
      .update(page)
      .set({
        accessType: "password",
        password: "test-secret-123",
        authEmailDomains: null,
      })
      .where(eq(page.id, testPasswordPageId));
  });
});

// ==========================================================================
// Code review fixes: validation edge cases
// ==========================================================================

describe("StatusPageService — password trimming", () => {
  test("create with whitespace-only password returns 400", async () => {
    const res = await connectRequest(
      "CreateStatusPage",
      {
        title: `${TEST_PREFIX}-ws-pw`,
        slug: `${TEST_PREFIX}-ws-pw-slug`,
        accessType: "PAGE_ACCESS_TYPE_PASSWORD_PROTECTED",
        password: "   ",
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.message).toContain("Password is required");
  });

  test("update with whitespace-only password returns 400", async () => {
    const res = await connectRequest(
      "UpdateStatusPage",
      {
        id: String(testPasswordPageId),
        accessType: "PAGE_ACCESS_TYPE_PASSWORD_PROTECTED",
        password: "   ",
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.message).toContain("Password is required");
  });
});

describe("StatusPageService — email domain validation", () => {
  test("create with whitespace-only domain returns 400", async () => {
    const res = await connectRequest(
      "CreateStatusPage",
      {
        title: `${TEST_PREFIX}-ws-domain`,
        slug: `${TEST_PREFIX}-ws-domain-slug`,
        accessType: "PAGE_ACCESS_TYPE_AUTHENTICATED",
        authEmailDomains: ["   "],
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.message).toContain("email domain");
  });

  test("create with domain missing dot returns 400", async () => {
    const res = await connectRequest(
      "CreateStatusPage",
      {
        title: `${TEST_PREFIX}-nodot-domain`,
        slug: `${TEST_PREFIX}-nodot-domain-slug`,
        accessType: "PAGE_ACCESS_TYPE_AUTHENTICATED",
        authEmailDomains: ["nodot"],
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.message).toContain("Invalid email domain");
  });

  test("create trims domain whitespace", async () => {
    const res = await connectRequest(
      "CreateStatusPage",
      {
        title: `${TEST_PREFIX}-trim-domain`,
        slug: `${TEST_PREFIX}-trim-domain-slug`,
        accessType: "PAGE_ACCESS_TYPE_AUTHENTICATED",
        authEmailDomains: [" example.com "],
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.statusPage.authEmailDomains).toEqual(["example.com"]);

    await db.delete(page).where(eq(page.id, Number(data.statusPage.id)));
  });
});

describe("StatusPageService — password-only update without accessType", () => {
  test("sending password without accessType does not update password", async () => {
    const res = await connectRequest(
      "UpdateStatusPage",
      {
        id: String(testPasswordPageId),
        password: "new-password-attempt",
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.statusPage.password).toBe("test-secret-123");
  });
});
