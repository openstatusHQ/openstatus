import { db } from "@openstatus/db";
import { page } from "@openstatus/db/src/schema";
import { createIncident } from "@openstatus/db/src/test/factories";
import { expect } from "@std/expect";
import { beforeAll, describe, test } from "@std/testing/bdd";

import {
  createWorkspaceFixture,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { ServiceContext } from "../../context";
import type { Workspace } from "../../types";
import { createStatusReport } from "../create";
import { getStatusReport, listStatusReports } from "../list";

const TEST_PREFIX = "svc-status-report-incident-id";

let workspace: Workspace;
let ctx: ServiceContext;
let pageId: number;

beforeAll(async () => {
  const fixture = await createWorkspaceFixture("team");
  workspace = fixture.workspace;
  ctx = makeUserCtx(workspace, { userId: fixture.userId });
  const row = await db
    .insert(page)
    .values({
      workspaceId: workspace.id,
      title: `${TEST_PREFIX}-page`,
      description: "",
      slug: `${TEST_PREFIX}-${workspace.id}`,
      customDomain: "",
    })
    .returning()
    .get();
  pageId = row.id;
});

function create(c: ServiceContext, incidentId?: number) {
  return createStatusReport({
    ctx: c,
    input: {
      title: `${TEST_PREFIX}-report`,
      status: "investigating",
      message: "m",
      date: new Date(),
      pageId,
      pageComponentIds: [],
      incidentId,
    },
  });
}

describe("status report incidentId", () => {
  test("is null when no incident links the report", async () => {
    await withTestTransaction(async (tx) => {
      const c = { ...ctx, db: tx };
      const { statusReport } = await create(c);
      const full = await getStatusReport({
        ctx: c,
        input: { id: statusReport.id },
      });
      expect(full.incidentId).toBeNull();
    });
  });

  test("get and list return the linked incident", async () => {
    await withTestTransaction(async (tx) => {
      const c = { ...ctx, db: tx };
      const linked = await createIncident(workspace.id, {}, tx);
      const { statusReport } = await create(c, linked.id);
      const full = await getStatusReport({
        ctx: c,
        input: { id: statusReport.id },
      });
      expect(full.incidentId).toBe(linked.id);
      const { items } = await listStatusReports({
        ctx: c,
        input: {
          pageId,
          limit: 100,
          offset: 0,
          statuses: [],
          order: "desc",
        },
      });
      const row = items.find((r) => r.id === statusReport.id);
      expect(row?.incidentId).toBe(linked.id);
    });
  });
});
