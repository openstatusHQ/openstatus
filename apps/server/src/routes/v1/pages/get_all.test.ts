import { afterAll, beforeAll, expect, test } from "bun:test";
import { db, eq } from "@openstatus/db";
import { monitor, page, pageComponent } from "@openstatus/db/src/schema";

import { app } from "@/index";
import { PageSchema } from "./schema";

const TEST_PREFIX = "v1-page-getall-test";
let testMonitorId: number;
let testPageId: number;

beforeAll(async () => {
  await db
    .delete(pageComponent)
    .where(eq(pageComponent.name, `${TEST_PREFIX}-component`));
  await db.delete(page).where(eq(page.slug, `${TEST_PREFIX}-slug`));
  await db.delete(monitor).where(eq(monitor.name, `${TEST_PREFIX}-monitor`));

  const mon = await db
    .insert(monitor)
    .values({
      workspaceId: 1,
      name: `${TEST_PREFIX}-monitor`,
      url: "https://test.example.com",
      periodicity: "1m",
      active: true,
      regions: "ams",
      jobType: "http",
      method: "GET",
      timeout: 30000,
    })
    .returning()
    .get();
  testMonitorId = mon.id;

  const p = await db
    .insert(page)
    .values({
      workspaceId: 1,
      title: `${TEST_PREFIX}-page`,
      slug: `${TEST_PREFIX}-slug`,
      description: "Test page",
      customDomain: "",
    })
    .returning()
    .get();
  testPageId = p.id;

  await db.insert(pageComponent).values({
    workspaceId: 1,
    pageId: testPageId,
    monitorId: testMonitorId,
    type: "monitor",
    name: `${TEST_PREFIX}-component`,
    order: 0,
  });
});

afterAll(async () => {
  await db
    .delete(pageComponent)
    .where(eq(pageComponent.name, `${TEST_PREFIX}-component`));
  await db.delete(page).where(eq(page.slug, `${TEST_PREFIX}-slug`));
  await db.delete(monitor).where(eq(monitor.name, `${TEST_PREFIX}-monitor`));
});

test("return all pages", async () => {
  const res = await app.request("/v1/page", {
    method: "GET",
    headers: {
      "x-openstatus-key": "1",
    },
  });

  const result = PageSchema.array().safeParse(await res.json());

  expect(res.status).toBe(200);
  expect(result.success).toBe(true);
  expect(result.data?.some((p) => p.id === testPageId)).toBe(true);
});

test("return empty pages", async () => {
  const res = await app.request("/v1/page", {
    method: "GET",
    headers: {
      "x-openstatus-key": "3",
    },
  });

  const result = PageSchema.array().safeParse(await res.json());

  expect(result.success).toBe(true);
  expect(res.status).toBe(200);
  expect(result.data?.length).toBe(0);
});

test("no auth key should return 401", async () => {
  const res = await app.request("/v1/page", {
    method: "GET",
  });

  expect(res.status).toBe(401);
});
