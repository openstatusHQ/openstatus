import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { db, eq } from "@openstatus/db";
import { auditLog } from "@openstatus/db/src/schema";

import type { AuditEntry } from "@openstatus/db/src/schema";
import { SEEDED_WORKSPACE_TEAM_ID } from "../../../test/fixtures";
import {
  clearAuditLog,
  loadSeededWorkspace,
  makeApiKeyCtx,
  makeSlackCtx,
  makeSystemCtx,
  makeUserCtx,
  readAuditLog,
} from "../../../test/helpers";
import type { ServiceContext } from "../../context";

import { diffTopLevel, emitAudit } from "../emit";

let teamCtx: ServiceContext;

beforeAll(async () => {
  const team = await loadSeededWorkspace(SEEDED_WORKSPACE_TEAM_ID);
  teamCtx = makeUserCtx(team, { userId: 1 });
});

beforeEach(async () => {
  await clearAuditLog(teamCtx.workspace.id);
});

afterAll(async () => {
  await clearAuditLog(SEEDED_WORKSPACE_TEAM_ID);
});

describe("diffTopLevel", () => {
  test("empty when objects are equal", () => {
    const result = diffTopLevel(
      { name: "a", count: 1 },
      { name: "a", count: 1 },
    );
    expect(result).toEqual([]);
  });

  test("reports top-level keys that differ", () => {
    const result = diffTopLevel(
      { name: "a", count: 1 },
      { name: "b", count: 1 },
    );
    expect(result).toEqual(["name"]);
  });

  test("reports additions and removals as changed", () => {
    const added = diffTopLevel({ name: "a" }, { name: "a", extra: "x" });
    expect(added).toEqual(["extra"]);
    const removed = diffTopLevel({ name: "a", extra: "x" }, { name: "a" });
    expect(removed).toEqual(["extra"]);
  });

  test("ignores updatedAt and createdAt", () => {
    const before = {
      name: "a",
      createdAt: new Date("2025-01-01"),
      updatedAt: new Date("2025-01-01"),
    };
    const after = {
      name: "a",
      createdAt: new Date("2025-06-01"),
      updatedAt: new Date("2025-06-01"),
    };
    expect(diffTopLevel(before, after)).toEqual([]);
  });

  test("reports non-ignored changes alongside ignored ones", () => {
    const before = {
      name: "a",
      updatedAt: new Date("2025-01-01"),
    };
    const after = {
      name: "b",
      updatedAt: new Date("2025-06-01"),
    };
    expect(diffTopLevel(before, after)).toEqual(["name"]);
  });

  test("treats null and undefined as absent — both absent means unchanged", () => {
    expect(diffTopLevel({ a: null }, { a: undefined })).toEqual([]);
    expect(diffTopLevel({ a: undefined }, { a: null })).toEqual([]);
    expect(diffTopLevel({}, { a: null })).toEqual([]);
    expect(diffTopLevel({ a: null }, {})).toEqual([]);
  });

  test("treats null → value as changed", () => {
    expect(diffTopLevel({ a: null }, { a: "x" })).toEqual(["a"]);
    expect(diffTopLevel({ a: "x" }, { a: null })).toEqual(["a"]);
  });

  test("top-level only — nested object changes report the parent key", () => {
    const before = { headers: { Authorization: "old" }, name: "a" };
    const after = { headers: { Authorization: "new" }, name: "a" };
    expect(diffTopLevel(before, after)).toEqual(["headers"]);
  });

  test("array equality is deep, not reference-based", () => {
    const before = { tags: [1, 2, 3] };
    const after = { tags: [1, 2, 3] };
    expect(diffTopLevel(before, after)).toEqual([]);
    const changed = diffTopLevel({ tags: [1, 2] }, { tags: [1, 2, 3] });
    expect(changed).toEqual(["tags"]);
  });
});

describe("emitAudit — row persistence", () => {
  test("inserts a row with the expected columns", async () => {
    await db.transaction(async (tx) => {
      await emitAudit(tx, teamCtx, {
        action: "monitor.create",
        entityType: "monitor",
        entityId: 9001,
        metadata: { jobType: "http", url: "https://example.com" },
      });
    });

    const rows = await readAuditLog({
      workspaceId: teamCtx.workspace.id,
      entityType: "monitor",
      entityId: 9001,
    });
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row).toBeDefined();
    if (!row) throw new Error("unreachable");
    expect(row.workspaceId).toBe(teamCtx.workspace.id);
    expect(row.action).toBe("monitor.create");
    expect(row.entityType).toBe("monitor");
    expect(row.entityId).toBe("9001");
    expect(row.actorType).toBe("user");
    expect(row.actorId).toBe("1");
    expect(row.actorUserId).toBe(1);
    expect(row.metadata).toEqual({
      jobType: "http",
      url: "https://example.com",
    });
    expect(row.before).toBeNull();
    expect(row.after).toBeNull();
    expect(row.changedFields).toBeNull();
    expect(row.createdAt).toBeInstanceOf(Date);
  });

  test("stringifies numeric entityIds", async () => {
    await db.transaction(async (tx) => {
      await emitAudit(tx, teamCtx, {
        action: "page.delete",
        entityType: "page",
        entityId: 42,
      });
    });
    const [row] = await readAuditLog({
      workspaceId: teamCtx.workspace.id,
      entityType: "page",
      entityId: 42,
    });
    expect(row?.entityId).toBe("42");
  });

  test("fail-closed: insert error rolls the enclosing tx back", async () => {
    let threw = false;
    try {
      await db.transaction(async (tx) => {
        await emitAudit(tx, teamCtx, {
          action: "monitor.create",
          entityType: "monitor",
          entityId: 9002,
        });
        throw new Error("simulated downstream failure");
      });
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
    const rows = await readAuditLog({
      workspaceId: teamCtx.workspace.id,
      entityType: "monitor",
      entityId: 9002,
    });
    expect(rows).toHaveLength(0);
  });
});

describe("emitAudit — changed_fields derivation", () => {
  test("null when only after is supplied (create-shape)", async () => {
    await db.transaction(async (tx) => {
      await emitAudit(tx, teamCtx, {
        action: "monitor.create",
        entityType: "monitor",
        entityId: 9100,
        after: { name: "fresh" },
      });
    });
    const [row] = await readAuditLog({
      workspaceId: teamCtx.workspace.id,
      entityType: "monitor",
      entityId: 9100,
    });
    expect(row?.changedFields).toBeNull();
  });

  test("null when only before is supplied (delete-shape)", async () => {
    await db.transaction(async (tx) => {
      await emitAudit(tx, teamCtx, {
        action: "monitor.delete",
        entityType: "monitor",
        entityId: 9101,
        before: { name: "going" },
      });
    });
    const [row] = await readAuditLog({
      workspaceId: teamCtx.workspace.id,
      entityType: "monitor",
      entityId: 9101,
    });
    expect(row?.changedFields).toBeNull();
  });

  test("no-op update (before === after) skips the insert entirely", async () => {
    await db.transaction(async (tx) => {
      await emitAudit(tx, teamCtx, {
        action: "monitor.update",
        entityType: "monitor",
        entityId: 9102,
        before: { name: "same", url: "https://x" },
        after: { name: "same", url: "https://x" },
      });
    });
    const rows = await readAuditLog({
      workspaceId: teamCtx.workspace.id,
      entityType: "monitor",
      entityId: 9102,
    });
    expect(rows).toHaveLength(0);
  });

  test("ignoring updatedAt/createdAt only → still a no-op, still skipped", async () => {
    await db.transaction(async (tx) => {
      await emitAudit(tx, teamCtx, {
        action: "monitor.update",
        entityType: "monitor",
        entityId: 9105,
        before: { name: "a", updatedAt: new Date("2025-01-01") },
        after: { name: "a", updatedAt: new Date("2025-06-01") },
      });
    });
    const rows = await readAuditLog({
      workspaceId: teamCtx.workspace.id,
      entityType: "monitor",
      entityId: 9105,
    });
    expect(rows).toHaveLength(0);
  });

  test("populated with the changed top-level keys", async () => {
    await db.transaction(async (tx) => {
      await emitAudit(tx, teamCtx, {
        action: "monitor.update",
        entityType: "monitor",
        entityId: 9103,
        before: { name: "old", url: "https://a", method: "GET" },
        after: { name: "new", url: "https://b", method: "GET" },
      });
    });
    const [row] = await readAuditLog({
      workspaceId: teamCtx.workspace.id,
      entityType: "monitor",
      entityId: 9103,
    });
    expect(row?.changedFields?.sort()).toEqual(["name", "url"]);
  });

  test("ignores updatedAt when computing the diff — a real change still records only the real key", async () => {
    await db.transaction(async (tx) => {
      await emitAudit(tx, teamCtx, {
        action: "monitor.update",
        entityType: "monitor",
        entityId: 9104,
        before: { name: "old", updatedAt: new Date("2025-01-01") },
        after: { name: "new", updatedAt: new Date("2025-06-01") },
      });
    });
    const [row] = await readAuditLog({
      workspaceId: teamCtx.workspace.id,
      entityType: "monitor",
      entityId: 9104,
    });
    expect(row?.changedFields).toEqual(["name"]);
  });
});

describe("emitAudit — actor derivation", () => {
  test("user actor → actorId and actorUserId are the same id", async () => {
    await db.transaction(async (tx) => {
      await emitAudit(tx, teamCtx, {
        action: "workspace.update",
        entityType: "workspace",
        entityId: teamCtx.workspace.id,
      });
    });
    const [row] = await readAuditLog({
      workspaceId: teamCtx.workspace.id,
      entityType: "workspace",
    });
    expect(row?.actorType).toBe("user");
    expect(row?.actorId).toBe("1");
    expect(row?.actorUserId).toBe(1);
  });

  test("apiKey actor without linked user → actorUserId null", async () => {
    const ctx = makeApiKeyCtx(teamCtx.workspace, { keyId: "k_anon" });
    await db.transaction(async (tx) => {
      await emitAudit(tx, ctx, {
        action: "api_key.delete",
        entityType: "api_key",
        entityId: 9200,
      });
    });
    const [row] = await readAuditLog({
      workspaceId: teamCtx.workspace.id,
      entityType: "api_key",
      entityId: 9200,
    });
    expect(row?.actorType).toBe("apiKey");
    expect(row?.actorId).toBe("k_anon");
    expect(row?.actorUserId).toBeNull();
  });

  test("apiKey actor with linked user → actorUserId populated", async () => {
    const ctx = makeApiKeyCtx(teamCtx.workspace, {
      keyId: "k_linked",
      userId: 42,
    });
    await db.transaction(async (tx) => {
      await emitAudit(tx, ctx, {
        action: "api_key.delete",
        entityType: "api_key",
        entityId: 9201,
      });
    });
    const [row] = await readAuditLog({
      workspaceId: teamCtx.workspace.id,
      entityType: "api_key",
      entityId: 9201,
    });
    expect(row?.actorType).toBe("apiKey");
    expect(row?.actorId).toBe("k_linked");
    expect(row?.actorUserId).toBe(42);
  });

  test("slack actor → actorId is slackUserId", async () => {
    const ctx = makeSlackCtx(teamCtx.workspace, {
      teamId: "T1",
      slackUserId: "U9",
      userId: 7,
    });
    await db.transaction(async (tx) => {
      await emitAudit(tx, ctx, {
        action: "maintenance.update",
        entityType: "maintenance",
        entityId: 9300,
      });
    });
    const [row] = await readAuditLog({
      workspaceId: teamCtx.workspace.id,
      entityType: "maintenance",
      entityId: 9300,
    });
    expect(row?.actorType).toBe("slack");
    expect(row?.actorId).toBe("U9");
    expect(row?.actorUserId).toBe(7);
  });

  test("system actor → actorId is the job name, actorUserId null", async () => {
    const ctx = makeSystemCtx(teamCtx.workspace, { job: "cleanup-job" });
    await db.transaction(async (tx) => {
      await emitAudit(tx, ctx, {
        action: "monitor.delete",
        entityType: "monitor",
        entityId: 9400,
      });
    });
    const [row] = await readAuditLog({
      workspaceId: teamCtx.workspace.id,
      entityType: "monitor",
      entityId: 9400,
    });
    expect(row?.actorType).toBe("system");
    expect(row?.actorId).toBe("cleanup-job");
    expect(row?.actorUserId).toBeNull();
  });
});

describe("emitAudit — ordering", () => {
  test("autoincrement id provides a stable tiebreaker within the same ms", async () => {
    await db.transaction(async (tx) => {
      for (let i = 0; i < 5; i++) {
        await emitAudit(tx, teamCtx, {
          action: "monitor.update",
          entityType: "monitor",
          entityId: 9500 + i,
        });
      }
    });
    const rows = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.workspaceId, teamCtx.workspace.id))
      .orderBy(auditLog.id)
      .all();
    const emitted = rows.filter((r) => r.action === "monitor.update");
    expect(emitted).toHaveLength(5);
    const ids = emitted.map((r) => Number(r.entityId));
    expect(ids).toEqual([9500, 9501, 9502, 9503, 9504]);
    // Ids are monotonically increasing → reads ordered by (createdAt DESC, id DESC)
    // get a deterministic order even when createdAt collides.
    for (let i = 1; i < emitted.length; i++) {
      const prev = emitted[i - 1];
      const curr = emitted[i];
      if (!prev || !curr) throw new Error("unreachable");
      expect(curr.id).toBeGreaterThan(prev.id);
    }
  });
});

describe("emitAudit — entry-shape regressions", () => {
  test("entry without metadata serializes null to the metadata column", async () => {
    const entry: AuditEntry = {
      action: "monitor.update",
      entityType: "monitor",
      entityId: 9600,
    };
    await db.transaction(async (tx) => {
      await emitAudit(tx, teamCtx, entry);
    });
    const [row] = await readAuditLog({
      workspaceId: teamCtx.workspace.id,
      entityType: "monitor",
      entityId: 9600,
    });
    expect(row?.metadata).toBeNull();
  });
});

describe("emitAudit — runtime Zod validation", () => {
  test("rejects an unknown action string", async () => {
    let threw = false;
    try {
      await db.transaction(async (tx) => {
        await emitAudit(tx, teamCtx, {
          // Cast through unknown — the runtime check is exactly the
          // point being tested; at compile time this would be a TS error.
          action: "monitor.bogus",
          entityType: "monitor",
          entityId: 9700,
        } as unknown as AuditEntry);
      });
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
    const rows = await readAuditLog({
      workspaceId: teamCtx.workspace.id,
      entityType: "monitor",
      entityId: 9700,
    });
    expect(rows).toHaveLength(0);
  });

  test("rejects a mismatched entityType for a known action", async () => {
    let threw = false;
    try {
      await db.transaction(async (tx) => {
        await emitAudit(tx, teamCtx, {
          action: "monitor.create",
          // `monitor.create` is bound to entityType: "monitor"; this should
          // fail the discriminator.
          entityType: "page",
          entityId: 9701,
        } as unknown as AuditEntry);
      });
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });

  test("rejects a non-integer entityId", async () => {
    let threw = false;
    try {
      await db.transaction(async (tx) => {
        await emitAudit(tx, teamCtx, {
          action: "monitor.delete",
          entityType: "monitor",
          // The schema requires `intId`; floats should fail.
          entityId: 1.5,
        } as unknown as AuditEntry);
      });
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });
});
