import { db } from "@openstatus/db";
import { maintenance, statusReport } from "@openstatus/db/src/schema";
import {
  createPage,
  createTestWorkspace,
} from "@openstatus/db/src/test/factories";
import { describe, expect, test } from "vitest";

import { getPublicPageStatusInputs } from "../index.ts";

describe("getPublicPageStatusInputs", () => {
  test("null for a missing or non-public page", async () => {
    const { workspace } = await createTestWorkspace();
    const gated = await createPage(workspace.id, { accessType: "password" });

    expect(
      await getPublicPageStatusInputs({ slug: "no-such-page-slug" }),
    ).toBeNull();
    expect(await getPublicPageStatusInputs({ slug: gated.slug })).toBeNull();
  });

  test("keeps only unresolved reports and ongoing maintenances", async () => {
    const { workspace } = await createTestWorkspace();
    const page = await createPage(workspace.id, { accessType: "public" });
    const now = new Date("2026-06-01T12:00:00Z");

    await db
      .insert(statusReport)
      .values([
        {
          workspaceId: workspace.id,
          pageId: page.id,
          title: "open",
          status: "investigating",
        },
        {
          workspaceId: workspace.id,
          pageId: page.id,
          title: "done",
          status: "resolved",
        },
      ])
      .run();
    await db
      .insert(maintenance)
      .values([
        {
          workspaceId: workspace.id,
          pageId: page.id,
          title: "now",
          message: "",
          from: new Date("2026-06-01T11:00:00Z"),
          to: new Date("2026-06-01T13:00:00Z"),
        },
        {
          workspaceId: workspace.id,
          pageId: page.id,
          title: "later",
          message: "",
          from: new Date("2026-06-02T11:00:00Z"),
          to: new Date("2026-06-02T13:00:00Z"),
        },
      ])
      .run();

    const inputs = await getPublicPageStatusInputs({ slug: page.slug, now });
    expect(inputs?.statusReports.map((r) => r.title)).toEqual(["open"]);
    expect(inputs?.maintenances.map((m) => m.title)).toEqual(["now"]);
    expect(inputs?.incidents).toEqual([]);
  });
});
