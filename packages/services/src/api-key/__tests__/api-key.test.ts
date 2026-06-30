import { beforeAll, describe, expect, test } from "bun:test";

import { eq } from "@openstatus/db";
import { apiKey } from "@openstatus/db/src/schema";

import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  updateApiKeyLastUsed,
  verifyApiKey,
} from "..";
import { SEEDED_WORKSPACE_TEAM_ID } from "../../../test/fixtures";
import {
  expectAuditRow,
  loadSeededWorkspace,
  makeApiKeyCtx,
  makeUserCtx,
  readAuditLog,
  withTestTransaction,
} from "../../../test/helpers";
import type { ServiceContext } from "../../context";
import { ForbiddenError, NotFoundError } from "../../errors";

const TEST_PREFIX = "svc-apikey-test";

let teamCtx: ServiceContext;

beforeAll(async () => {
  const team = await loadSeededWorkspace(SEEDED_WORKSPACE_TEAM_ID);
  teamCtx = makeUserCtx(team, { userId: 1 });
});

describe("createApiKey", () => {
  test("returns plaintext token once and stores a bcrypt hash", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const { token, key } = await createApiKey({
        ctx,
        input: { name: `${TEST_PREFIX}-create` },
      });

      expect(token).toMatch(/^os_[a-f0-9]{32}$/);
      expect(key.workspaceId).toBe(SEEDED_WORKSPACE_TEAM_ID);

      const stored = await tx
        .select({ hashedToken: apiKey.hashedToken })
        .from(apiKey)
        .where(eq(apiKey.id, key.id))
        .get();
      expect(stored?.hashedToken).toMatch(/^\$2[aby]\$/);

      await expectAuditRow({
        workspaceId: ctx.workspace.id,
        action: "api_key.create",
        entityType: "api_key",
        entityId: key.id,
        db: tx,
      });
    });
  });

  test("defaults scopes to ['write'] when omitted", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const { key } = await createApiKey({
        ctx,
        input: { name: `${TEST_PREFIX}-default-scope` },
      });
      expect(key.scopes).toEqual(["write"]);
    });
  });

  test("persists ['read'] when explicitly set", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const { key } = await createApiKey({
        ctx,
        input: { name: `${TEST_PREFIX}-read-scope`, scopes: ["read"] },
      });
      expect(key.scopes).toEqual(["read"]);
    });
  });

  test("rejects '*' at the input boundary (privilege-escalation guard)", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      await expect(
        createApiKey({
          ctx,
          input: {
            name: `${TEST_PREFIX}-star`,
            scopes: ["*"] as any,
          },
        }),
      ).rejects.toThrow();
    });
  });

  test("rejects empty scopes []", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      await expect(
        createApiKey({
          ctx,
          input: { name: `${TEST_PREFIX}-empty-scope`, scopes: [] },
        }),
      ).rejects.toThrow();
    });
  });

  test("rejects read-only actor", async () => {
    await withTestTransaction(async (tx) => {
      const team = await loadSeededWorkspace(SEEDED_WORKSPACE_TEAM_ID);
      const readOnlyCtx = {
        ...makeApiKeyCtx(team, {
          keyId: "k-read",
          userId: 1,
          scopes: ["read"],
        }),
        db: tx,
      };
      await expect(
        createApiKey({
          ctx: readOnlyCtx,
          input: { name: `${TEST_PREFIX}-rejects-read` },
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });
});

describe("listApiKeys", () => {
  test("enriches each key with creator info", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const { key } = await createApiKey({
        ctx,
        input: { name: `${TEST_PREFIX}-list` },
      });

      const rows = await listApiKeys({ ctx });
      const found = rows.find((r) => r.id === key.id);
      expect(found).toBeDefined();
      expect(found?.createdBy?.id).toBe(1);
    });
  });
});

describe("revokeApiKey", () => {
  test("deletes the key and throws NotFoundError for unknown ids", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const { key } = await createApiKey({
        ctx,
        input: { name: `${TEST_PREFIX}-revoke` },
      });

      await revokeApiKey({ ctx, input: { id: key.id } });

      const row = await tx
        .select({ id: apiKey.id })
        .from(apiKey)
        .where(eq(apiKey.id, key.id))
        .get();
      expect(row).toBeUndefined();

      await expect(
        revokeApiKey({ ctx, input: { id: 999_999_999 } }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  test("self-revoke carve-out: read-only key can revoke itself", async () => {
    await withTestTransaction(async (tx) => {
      const team = await loadSeededWorkspace(SEEDED_WORKSPACE_TEAM_ID);
      // Create the key as a user so we get a real row id back.
      const { key } = await createApiKey({
        ctx: { ...teamCtx, db: tx },
        input: { name: `${TEST_PREFIX}-self-revoke`, scopes: ["read"] },
      });

      // Now revoke as the read-only key itself — should succeed.
      const selfCtx = {
        ...makeApiKeyCtx(team, {
          keyId: String(key.id),
          userId: 1,
          scopes: ["read"],
        }),
        db: tx,
      };
      await revokeApiKey({ ctx: selfCtx, input: { id: key.id } });

      const row = await tx
        .select({ id: apiKey.id })
        .from(apiKey)
        .where(eq(apiKey.id, key.id))
        .get();
      expect(row).toBeUndefined();
    });
  });

  test("audit row captures scopes in `before` snapshot", async () => {
    // Create with a non-default scope, revoke, and confirm the audit
    // row's `before` snapshot carries it. Asserts the create/delete
    // pair stays symmetric — both sides should expose `scopes` so
    // reviewers can answer "what scope did this key have?" without
    // querying a deleted row.
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const { key } = await createApiKey({
        ctx,
        input: { name: `${TEST_PREFIX}-audit-snap`, scopes: ["read"] },
      });
      await revokeApiKey({ ctx, input: { id: key.id } });

      const rows = await readAuditLog({
        workspaceId: ctx.workspace.id,
        entityType: "api_key",
        entityId: key.id,
        db: tx,
      });
      const deleteRow = rows.find((r) => r.action === "api_key.delete");
      const createRow = rows.find((r) => r.action === "api_key.create");

      expect(deleteRow?.before).toMatchObject({
        id: key.id,
        prefix: key.prefix,
        scopes: ["read"],
      });
      expect(createRow?.after).toMatchObject({
        id: key.id,
        prefix: key.prefix,
        scopes: ["read"],
      });
      // Symmetry: snapshots strip the same secret/header columns.
      const forbidden = ["hashedToken", "workspaceId", "createdById"];
      for (const k of forbidden) {
        expect(deleteRow?.before).not.toHaveProperty(k);
        expect(createRow?.after).not.toHaveProperty(k);
      }
    });
  });

  test("read-only actor cannot revoke a different key", async () => {
    await withTestTransaction(async (tx) => {
      const team = await loadSeededWorkspace(SEEDED_WORKSPACE_TEAM_ID);
      const { key } = await createApiKey({
        ctx: { ...teamCtx, db: tx },
        input: { name: `${TEST_PREFIX}-other-key` },
      });

      // Read-only actor with a different keyId tries to revoke `key`.
      const otherCtx = {
        ...makeApiKeyCtx(team, {
          keyId: "different-key-id",
          userId: 1,
          scopes: ["read"],
        }),
        db: tx,
      };
      await expect(
        revokeApiKey({ ctx: otherCtx, input: { id: key.id } }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });
});

describe("verifyApiKey", () => {
  test("resolves the stored row for a valid token", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const { token, key } = await createApiKey({
        ctx,
        input: { name: `${TEST_PREFIX}-verify` },
      });

      const row = await verifyApiKey({ token }, { db: tx });
      expect(row?.id).toBe(key.id);
    });
  });

  test("returns null for malformed tokens", async () => {
    await withTestTransaction(async (tx) => {
      const row = await verifyApiKey({ token: "not-an-os-key" }, { db: tx });
      expect(row).toBeNull();
    });
  });

  test("returns null for a prefix-match with wrong body", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const { token } = await createApiKey({
        ctx,
        input: { name: `${TEST_PREFIX}-verify-wrong` },
      });

      const wrong = `${token.slice(0, 11)}${"f".repeat(24)}`;
      const row = await verifyApiKey({ token: wrong }, { db: tx });
      expect(row).toBeNull();
    });
  });
});

describe("updateApiKeyLastUsed", () => {
  test("skips the write when lastUsedAt is recent", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const { key } = await createApiKey({
        ctx,
        input: { name: `${TEST_PREFIX}-lastused` },
      });

      const now = new Date();
      const wrote = await updateApiKeyLastUsed(
        { id: key.id, lastUsedAt: now },
        { db: tx },
      );
      expect(wrote).toBe(false);
    });
  });

  test("writes when lastUsedAt is null or past the debounce window", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const { key } = await createApiKey({
        ctx,
        input: { name: `${TEST_PREFIX}-lastused-null` },
      });

      const wrote = await updateApiKeyLastUsed(
        { id: key.id, lastUsedAt: null },
        { db: tx },
      );
      expect(wrote).toBe(true);

      const row = await tx
        .select({ lastUsedAt: apiKey.lastUsedAt })
        .from(apiKey)
        .where(eq(apiKey.id, key.id))
        .get();
      expect(row?.lastUsedAt).toBeInstanceOf(Date);
    });
  });
});
