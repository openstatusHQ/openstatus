import { expect, test } from "bun:test";

import { app } from "@/index";
import { db, eq } from "@openstatus/db";
import {
  monitor,
  monitorsToPages,
  page,
  pageComponent,
} from "@openstatus/db/src/schema";
import { PageSchema } from "./schema";

test("create a valid page", async () => {
  const uniqueSlug = `openstatus-${Date.now()}`;
  const res = await app.request("/v1/page", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      title: "OpenStatus",
      description: "OpenStatus website",
      slug: uniqueSlug,
      monitors: [1],
    }),
  });

  const result = PageSchema.safeParse(await res.json());

  expect(res.status).toBe(200);
  expect(result.success).toBe(true);

  // Cleanup: delete the created page
  if (result.success) {
    await db.delete(page).where(eq(page.id, result.data.id));
  }
});

test("create a page with invalid monitor ids should return a 400", async () => {
  const res = await app.request("/v1/page", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      title: "OpenStatus",
      description: "OpenStatus website",
      slug: "another-openstatus",
      monitors: [404],
    }),
  });

  expect(res.status).toBe(400);
});

test("create a page with password on free plan should return a 402", async () => {
  const res = await app.request("/v1/page", {
    method: "POST",
    headers: {
      "x-openstatus-key": "2",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      title: "OpenStatus",
      description: "OpenStatus website",
      slug: "password-openstatus",
      passwordProtected: true,
    }),
  });

  expect(res.status).toBe(402);
});

test("create a email page with invalid payload should return a 400", async () => {
  const res = await app.request("/v1/page", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      name: "OpenStatus",
      provider: "email",
      payload: { hello: "world" },
    }),
  });

  expect(res.status).toBe(400);
});

test("no auth key should return 401", async () => {
  const res = await app.request("/v1/page", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
  });

  expect(res.status).toBe(401);
});

test("create a page with custom domain without limits should return 402", async () => {
  const res = await app.request("/v1/page", {
    method: "POST",
    headers: {
      "x-openstatus-key": "2", // Free plan
      "content-type": "application/json",
    },
    body: JSON.stringify({
      title: "OpenStatus",
      description: "OpenStatus website",
      slug: `custom-domain-${Date.now()}`,
      customDomain: "status.example.com",
    }),
  });

  expect(res.status).toBe(402);
  const json = await res.json();
  expect(json.message).toBe("Upgrade for custom domains");
});

test("create a page with custom domain containing 'openstatus' should return 400", async () => {
  const res = await app.request("/v1/page", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      title: "OpenStatus",
      description: "OpenStatus website",
      slug: `openstatus-domain-${Date.now()}`,
      customDomain: "status.openstatus.dev",
    }),
  });

  expect(res.status).toBe(400);
  const json = await res.json();
  expect(json.message).toBe("Domain cannot contain 'openstatus'");
});

test("create a page with reserved slug should return 400", async () => {
  const res = await app.request("/v1/page", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      title: "OpenStatus",
      description: "OpenStatus website",
      slug: "api", // Reserved slug
    }),
  });

  expect(res.status).toBe(400);
  const json = await res.json();
  expect(json.message).toBe("Slug is reserved");
});

test("create a page with duplicate slug should return 400", async () => {
  const uniqueSlug = `duplicate-test-${Date.now()}`;

  // Create first page
  const res1 = await app.request("/v1/page", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      title: "OpenStatus First",
      description: "First page",
      slug: uniqueSlug,
    }),
  });

  expect(res1.status).toBe(200);
  const result1 = PageSchema.safeParse(await res1.json());
  expect(result1.success).toBe(true);

  // Try to create second page with same slug
  const res2 = await app.request("/v1/page", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      title: "OpenStatus Second",
      description: "Second page",
      slug: uniqueSlug,
    }),
  });

  expect(res2.status).toBe(400);
  const json = await res2.json();
  expect(json.message).toBe("Slug has to be unique and has already been taken");

  // Cleanup
  if (result1.success) {
    await db.delete(page).where(eq(page.id, result1.data.id));
  }
});

test("create a page with email domain protection on free plan should return 402", async () => {
  const res = await app.request("/v1/page", {
    method: "POST",
    headers: {
      "x-openstatus-key": "2", // Free plan
      "content-type": "application/json",
    },
    body: JSON.stringify({
      title: "OpenStatus",
      description: "OpenStatus website",
      slug: `email-domain-${Date.now()}`,
      accessType: "email-domain",
      authEmailDomains: ["example.com"],
    }),
  });

  expect(res.status).toBe(402);
  const json = await res.json();
  expect(json.message).toBe("Upgrade for email domain protection");
});

test("create a page with accessType password on free plan should return 402", async () => {
  const res = await app.request("/v1/page", {
    method: "POST",
    headers: {
      "x-openstatus-key": "2", // Free plan
      "content-type": "application/json",
    },
    body: JSON.stringify({
      title: "OpenStatus",
      description: "OpenStatus website",
      slug: `access-type-password-${Date.now()}`,
      accessType: "password",
      password: "secret123",
    }),
  });

  expect(res.status).toBe(402);
  const json = await res.json();
  expect(json.message).toBe("Upgrade for password protection");
});

test("create a page with monitors as objects with order", async () => {
  const uniqueSlug = `ordered-monitors-${Date.now()}`;
  const res = await app.request("/v1/page", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      title: "OpenStatus Ordered",
      description: "Page with ordered monitors",
      slug: uniqueSlug,
      monitors: [
        { monitorId: 1, order: 1 },
        { monitorId: 2, order: 0 },
      ],
    }),
  });

  expect(res.status).toBe(200);
  const result = PageSchema.safeParse(await res.json());
  expect(result.success).toBe(true);

  if (result.success) {
    // Verify pageComponent entries were created with correct order
    const components = await db
      .select()
      .from(pageComponent)
      .where(eq(pageComponent.pageId, result.data.id))
      .all();

    expect(components.length).toBe(2);
    expect(components.find((c) => c.monitorId === 1)?.order).toBe(1);
    expect(components.find((c) => c.monitorId === 2)?.order).toBe(0);

    // Verify sync to legacy table
    const legacyEntries = await db
      .select()
      .from(monitorsToPages)
      .where(eq(monitorsToPages.pageId, result.data.id))
      .all();

    expect(legacyEntries.length).toBe(2);
    expect(legacyEntries.find((e) => e.monitorId === 1)?.order).toBe(1);
    expect(legacyEntries.find((e) => e.monitorId === 2)?.order).toBe(0);

    // Cleanup
    await db.delete(page).where(eq(page.id, result.data.id));
  }
});

test("create a page without monitors should succeed", async () => {
  const uniqueSlug = `no-monitors-${Date.now()}`;
  const res = await app.request("/v1/page", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      title: "OpenStatus No Monitors",
      description: "Page without monitors",
      slug: uniqueSlug,
    }),
  });

  expect(res.status).toBe(200);
  const result = PageSchema.safeParse(await res.json());
  expect(result.success).toBe(true);

  if (result.success) {
    // Verify no pageComponent entries were created
    const components = await db
      .select()
      .from(pageComponent)
      .where(eq(pageComponent.pageId, result.data.id))
      .all();

    expect(components.length).toBe(0);

    // Cleanup
    await db.delete(page).where(eq(page.id, result.data.id));
  }
});

test("create a page with monitors as number array should use index as order", async () => {
  const uniqueSlug = `number-array-${Date.now()}`;
  const res = await app.request("/v1/page", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      title: "OpenStatus Number Array",
      description: "Page with monitors as numbers",
      slug: uniqueSlug,
      monitors: [2, 1],
    }),
  });

  expect(res.status).toBe(200);
  const result = PageSchema.safeParse(await res.json());
  expect(result.success).toBe(true);

  if (result.success) {
    // Verify pageComponent entries were created with index as order
    const components = await db
      .select()
      .from(pageComponent)
      .where(eq(pageComponent.pageId, result.data.id))
      .all();

    expect(components.length).toBe(2);
    expect(components.find((c) => c.monitorId === 2)?.order).toBe(0);
    expect(components.find((c) => c.monitorId === 1)?.order).toBe(1);

    // Cleanup
    await db.delete(page).where(eq(page.id, result.data.id));
  }
});

test("create a page with partial invalid monitors should return 400", async () => {
  const res = await app.request("/v1/page", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      title: "OpenStatus",
      description: "OpenStatus website",
      slug: `partial-invalid-${Date.now()}`,
      monitors: [1, 999], // 1 exists, 999 doesn't
    }),
  });

  expect(res.status).toBe(400);
  const json = await res.json();
  expect(json.message).toContain("not found");
});

test("create a page syncs correctly to pageComponent and legacy monitorsToPages", async () => {
  const uniqueSlug = `sync-test-${Date.now()}`;
  const res = await app.request("/v1/page", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      title: "Sync Test",
      description: "Testing sync to both tables",
      slug: uniqueSlug,
      monitors: [{ monitorId: 1, order: 0 }],
    }),
  });

  expect(res.status).toBe(200);
  const result = PageSchema.safeParse(await res.json());
  expect(result.success).toBe(true);

  if (result.success) {
    // Verify pageComponent (primary table)
    const components = await db
      .select()
      .from(pageComponent)
      .where(eq(pageComponent.pageId, result.data.id))
      .all();

    expect(components.length).toBe(1);
    expect(components[0].monitorId).toBe(1);
    expect(components[0].type).toBe("monitor");

    // Verify monitorsToPages (legacy table)
    const legacyEntries = await db
      .select()
      .from(monitorsToPages)
      .where(eq(monitorsToPages.pageId, result.data.id))
      .all();

    expect(legacyEntries.length).toBe(1);
    expect(legacyEntries[0].monitorId).toBe(1);

    // Cleanup
    await db.delete(page).where(eq(page.id, result.data.id));
  }
});

test("create a page uses monitor externalName when available", async () => {
  const uniqueSlug = `external-name-${Date.now()}`;

  // First, check if monitor has externalName set
  const monitorData = await db
    .select()
    .from(monitor)
    .where(eq(monitor.id, 1))
    .get();

  const res = await app.request("/v1/page", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      title: "External Name Test",
      description: "Testing monitor external name",
      slug: uniqueSlug,
      monitors: [1],
    }),
  });

  expect(res.status).toBe(200);
  const result = PageSchema.safeParse(await res.json());
  expect(result.success).toBe(true);

  if (result.success) {
    const components = await db
      .select()
      .from(pageComponent)
      .where(eq(pageComponent.pageId, result.data.id))
      .all();

    expect(components.length).toBe(1);
    // Should use externalName if available, otherwise name
    const expectedName = monitorData?.externalName || monitorData?.name;
    expect(components[0].name).toBe(expectedName);

    // Cleanup
    await db.delete(page).where(eq(page.id, result.data.id));
  }
});
