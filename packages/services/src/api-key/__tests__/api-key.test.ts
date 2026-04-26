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
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { ServiceContext } from "../../context";
import { NotFoundError } from "../../errors";

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
