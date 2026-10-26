import { db, eq } from "@openstatus/db";
import {
  page,
  statusReport,
  statusReportUpdate,
} from "@openstatus/db/src/schema";
import {
  createPage,
  createTestWorkspace,
} from "@openstatus/db/src/test/factories";
import { NextRequest } from "next/server.js";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { appRouter } from "../root";
import { createInnerTRPCContext } from "../trpc";
import { sortStatusReportsByLatestUpdate } from "./statusPage";

let workspaceId: number;
let pageId: number;
let slug: string;

function caller() {
  return appRouter.createCaller(
    createInnerTRPCContext({
      req: new NextRequest("http://rsc.internal"),
      session: null,
    }),
  );
}

describe("sortStatusReportsByLatestUpdate", () => {
  test("orders reports without updates first, then by latest update date descending, breaking ties by id", () => {
    const reports = [
      {
        id: 1,
        statusReportUpdates: [{ date: new Date("2026-02-01T00:00:00Z") }],
      },
      {
        id: 2,
        statusReportUpdates: [
          { date: new Date("2026-03-01T00:00:00Z") },
          { date: new Date("2026-01-01T00:00:00Z") },
        ],
      },
      {
        id: 3,
        statusReportUpdates: [],
      },
      {
        id: 4,
        statusReportUpdates: [],
      },
      {
        id: 5,
        statusReportUpdates: [{ date: new Date("2026-03-01T00:00:00Z") }],
      },
    ];

    const sortedIds = [...reports]
      .sort(sortStatusReportsByLatestUpdate)
      .map((report) => report.id);

    expect(sortedIds).toEqual([4, 3, 5, 2, 1]);
  });
});

describe("statusPage.get and statusPage.getLight report order", () => {
  beforeAll(async () => {
    const fixture = await createTestWorkspace();
    workspaceId = fixture.workspace.id;
    const createdPage = await createPage(workspaceId);
    pageId = createdPage.id;
    slug = createdPage.slug;
  });

  afterAll(async () => {
    await db.delete(statusReport).where(eq(statusReport.pageId, pageId));
    await db.delete(page).where(eq(page.workspaceId, workspaceId));
  });

  test("uses each report's newest update and puts reports without updates first", async () => {
    const olderActivity = await db
      .insert(statusReport)
      .values({
        workspaceId,
        pageId,
        title: "Older activity",
        status: "investigating",
      })
      .returning()
      .get();
    const recentActivity = await db
      .insert(statusReport)
      .values({
        workspaceId,
        pageId,
        title: "Recent activity",
        status: "investigating",
      })
      .returning()
      .get();
    const noUpdates = await db
      .insert(statusReport)
      .values({
        workspaceId,
        pageId,
        title: "No updates",
        status: "investigating",
      })
      .returning()
      .get();

    await db.insert(statusReportUpdate).values([
      {
        statusReportId: recentActivity.id,
        status: "investigating",
        message: "Initial update",
        date: new Date("2026-01-01T00:00:00Z"),
      },
      {
        statusReportId: olderActivity.id,
        status: "investigating",
        message: "Other report update",
        date: new Date("2026-02-01T00:00:00Z"),
      },
      {
        statusReportId: recentActivity.id,
        status: "investigating",
        message: "Newest update",
        date: new Date("2026-03-01T00:00:00Z"),
      },
    ]);

    const expectedOrder = [
      noUpdates.id,
      recentActivity.id,
      olderActivity.id,
    ];

    const result = await caller().statusPage.get({ slug });
    expect(result?.statusReports.map((report) => report.id)).toEqual(
      expectedOrder,
    );

    const lightResult = await caller().statusPage.getLight({ slug });
    expect(lightResult?.statusReports.map((report) => report.id)).toEqual(
      expectedOrder,
    );
  });

  test("breaks equal activity dates and reports without updates by id", async () => {
    const first = await db
      .insert(statusReport)
      .values({
        workspaceId,
        pageId,
        title: "First tie",
        status: "investigating",
      })
      .returning()
      .get();
    const second = await db
      .insert(statusReport)
      .values({
        workspaceId,
        pageId,
        title: "Second tie",
        status: "investigating",
      })
      .returning()
      .get();
    const firstNoUpdates = await db
      .insert(statusReport)
      .values({
        workspaceId,
        pageId,
        title: "First without updates",
        status: "investigating",
      })
      .returning()
      .get();
    const secondNoUpdates = await db
      .insert(statusReport)
      .values({
        workspaceId,
        pageId,
        title: "Second without updates",
        status: "investigating",
      })
      .returning()
      .get();

    const date = new Date("2026-04-01T00:00:00Z");
    await db.insert(statusReportUpdate).values([
      {
        statusReportId: first.id,
        status: "investigating",
        message: "First",
        date,
      },
      {
        statusReportId: second.id,
        status: "investigating",
        message: "Second",
        date,
      },
    ]);

    const expectedTieOrder = [
      secondNoUpdates.id,
      firstNoUpdates.id,
      second.id,
      first.id,
    ];

    const result = await caller().statusPage.get({ slug });
    const ids = result?.statusReports.map((report) => report.id);
    expect(
      ids?.filter((id) =>
        [first.id, second.id, firstNoUpdates.id, secondNoUpdates.id].includes(
          id,
        ),
      ),
    ).toEqual(expectedTieOrder);

    const lightResult = await caller().statusPage.getLight({ slug });
    const lightIds = lightResult?.statusReports.map((report) => report.id);
    expect(
      lightIds?.filter((id) =>
        [first.id, second.id, firstNoUpdates.id, secondNoUpdates.id].includes(
          id,
        ),
      ),
    ).toEqual(expectedTieOrder);
  });
});
