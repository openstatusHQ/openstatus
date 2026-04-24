import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { db, eq } from "@openstatus/db";
import { workspace } from "@openstatus/db/src/schema";

import {
  getWorkspace,
  getWorkspaceWithUsage,
  listWorkspaces,
  updateWorkspaceName,
} from "..";
import { SEEDED_WORKSPACE_TEAM_ID } from "../../../test/fixtures";
import {
  expectAuditRow,
  loadSeededWorkspace,
  makeUserCtx,
  withAuditBuffer,
} from "../../../test/helpers";
import type { AuditLogRecord } from "../../audit";
import type { ServiceContext } from "../../context";

let teamCtx: ServiceContext;
let originalName: string | null = null;
let auditBuffer: AuditLogRecord[];
let auditReset: () => void;

beforeAll(async () => {
  const team = await loadSeededWorkspace(SEEDED_WORKSPACE_TEAM_ID);
  teamCtx = makeUserCtx(team, { userId: 1 });
  originalName = team.name;
});

afterAll(async () => {
  if (originalName !== null) {
    await db
      .update(workspace)
      .set({ name: originalName })
      .where(eq(workspace.id, SEEDED_WORKSPACE_TEAM_ID));
  }
});

beforeEach(() => {
  const session = withAuditBuffer();
  auditBuffer = session.buffer;
  auditReset = session.reset;
});
afterEach(() => auditReset());

describe("getWorkspace", () => {
  test("returns the caller's workspace", async () => {
    const result = await getWorkspace({ ctx: teamCtx });
    expect(result.id).toBe(SEEDED_WORKSPACE_TEAM_ID);
    expect(typeof result.limits).toBe("object");
  });
});

describe("getWorkspaceWithUsage", () => {
  test("attaches a zero-or-positive usage block", async () => {
    const result = await getWorkspaceWithUsage({ ctx: teamCtx });
    expect(result.id).toBe(SEEDED_WORKSPACE_TEAM_ID);
    expect(result.usage).toMatchObject({
      monitors: expect.any(Number),
      notifications: expect.any(Number),
      pages: expect.any(Number),
      pageComponents: expect.any(Number),
      checks: 0,
    });
    for (const value of Object.values(result.usage)) {
      expect(value).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("listWorkspaces", () => {
  test("returns every workspace a user belongs to", async () => {
    const rows = await listWorkspaces({
      ctx: teamCtx,
      input: { userId: 1 },
    });
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(SEEDED_WORKSPACE_TEAM_ID);
  });

  test("returns an empty list for a user with no memberships", async () => {
    const rows = await listWorkspaces({
      ctx: teamCtx,
      input: { userId: 999_999 },
    });
    expect(rows).toEqual([]);
  });
});

describe("updateWorkspaceName", () => {
  test("renames the workspace and emits an audit row", async () => {
    const nextName = `svc-ws-test-${Date.now()}`;
    await updateWorkspaceName({
      ctx: teamCtx,
      input: { name: nextName },
    });

    const row = await db
      .select()
      .from(workspace)
      .where(eq(workspace.id, SEEDED_WORKSPACE_TEAM_ID))
      .get();
    expect(row?.name).toBe(nextName);

    await expectAuditRow(auditBuffer, {
      action: "workspace.update_name",
      entityType: "workspace",
      entityId: SEEDED_WORKSPACE_TEAM_ID,
      actorType: "user",
    });
  });
});
