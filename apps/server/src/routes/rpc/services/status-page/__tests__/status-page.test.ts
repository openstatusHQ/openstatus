import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { db, eq } from "@openstatus/db";
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

beforeAll(async () => {
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

  // Create a test page
  const testPage = await db
    .insert(page)
    .values({
      workspaceId: 1,
      title: `${TEST_PREFIX}-page`,
      slug: `${TEST_PREFIX}-slug`,
      description: "Test page for status page tests",
      customDomain: "",
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
      type: "external",
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
      type: "external",
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
      type: "external",
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
});

describe("StatusPageService.AddExternalComponent", () => {
  test("adds external component to page", async () => {
    const res = await connectRequest(
      "AddExternalComponent",
      {
        pageId: String(testPageId),
        name: `${TEST_PREFIX}-external-component`,
        description: "External service",
        order: 300,
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("component");
    expect(data.component.name).toBe(`${TEST_PREFIX}-external-component`);
    expect(data.component.type).toBe("PAGE_COMPONENT_TYPE_STATIC");
    expect(data.component.description).toBe("External service");

    // Clean up
    await db
      .delete(pageComponent)
      .where(eq(pageComponent.id, Number(data.component.id)));
  });

  test("returns 401 when no auth key provided", async () => {
    const res = await connectRequest("AddExternalComponent", {
      pageId: String(testPageId),
      name: "Unauthorized component",
    });

    expect(res.status).toBe(401);
  });

  test("returns 404 for non-existent page", async () => {
    const res = await connectRequest(
      "AddExternalComponent",
      {
        pageId: "99999",
        name: "Component for non-existent page",
      },
      { "x-openstatus-key": "1" },
    );

    expect(res.status).toBe(404);
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

  test("unsubscribes by token", async () => {
    // First subscribe a new user
    const subscribeRes = await connectRequest(
      "SubscribeToPage",
      {
        pageId: String(testPageId),
        email: `${TEST_PREFIX}-unsub-token@example.com`,
      },
      { "x-openstatus-key": "1" },
    );
    const subscribeData = await subscribeRes.json();

    // Get the token from DB
    const subscriber = await db
      .select()
      .from(pageSubscriber)
      .where(eq(pageSubscriber.id, Number(subscribeData.subscriber.id)))
      .get();

    // Then unsubscribe by token
    const res = await connectRequest(
      "UnsubscribeFromPage",
      {
        pageId: String(testPageId),
        token: subscriber?.token,
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
