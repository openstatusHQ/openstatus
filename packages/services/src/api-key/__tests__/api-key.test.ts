import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { db, eq, inArray } from "@openstatus/db";
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
  withAuditBuffer,
} from "../../../test/helpers";
import type { AuditLogRecord } from "../../audit";
import type { ServiceContext } from "../../context";
import { NotFoundError } from "../../errors";

const TEST_PREFIX = "svc-apikey-test";

let teamCtx: ServiceContext;
let auditBuffer: AuditLogRecord[];
let auditReset: () => void;
const createdKeyIds: number[] = [];

beforeAll(async () => {
  const team = await loadSeededWorkspace(SEEDED_WORKSPACE_TEAM_ID);
  teamCtx = makeUserCtx(team, { userId: 1 });
});

afterAll(async () => {
  if (createdKeyIds.length > 0) {
    await db.delete(apiKey).where(inArray(apiKey.id, createdKeyIds));
  }
});

beforeEach(() => {
  const session = withAuditBuffer();
  auditBuffer = session.buffer;
  auditReset = session.reset;
});
afterEach(() => auditReset());

describe("createApiKey", () => {
  test("returns plaintext token once and stores a bcrypt hash", async () => {
    const { token, key } = await createApiKey({
      ctx: teamCtx,
      input: {
        name: `${TEST_PREFIX}-create`,
        createdById: 1,
      },
    });
    createdKeyIds.push(key.id);

    expect(token).toMatch(/^os_[a-f0-9]{32}$/);
    expect(key.workspaceId).toBe(SEEDED_WORKSPACE_TEAM_ID);
    expect(key.hashedToken).toMatch(/^\$2[aby]\$/);

    await expectAuditRow(auditBuffer, {
      action: "api_key.create",
      entityType: "api_key",
      entityId: key.id,
    });
  });
});

describe("listApiKeys", () => {
  test("enriches each key with creator info", async () => {
    const { key } = await createApiKey({
      ctx: teamCtx,
      input: { name: `${TEST_PREFIX}-list`, createdById: 1 },
    });
    createdKeyIds.push(key.id);

    const rows = await listApiKeys({ ctx: teamCtx });
    const found = rows.find((r) => r.id === key.id);
    expect(found).toBeDefined();
    expect(found?.createdBy?.id).toBe(1);
  });
});

describe("revokeApiKey", () => {
  test("deletes the key and throws NotFoundError for unknown ids", async () => {
    const { key } = await createApiKey({
      ctx: teamCtx,
      input: { name: `${TEST_PREFIX}-revoke`, createdById: 1 },
    });

    await revokeApiKey({ ctx: teamCtx, input: { id: key.id } });

    const row = await db
      .select({ id: apiKey.id })
      .from(apiKey)
      .where(eq(apiKey.id, key.id))
      .get();
    expect(row).toBeUndefined();

    await expect(
      revokeApiKey({ ctx: teamCtx, input: { id: 999_999_999 } }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("verifyApiKey", () => {
  test("resolves the stored row for a valid token", async () => {
    const { token, key } = await createApiKey({
      ctx: teamCtx,
      input: { name: `${TEST_PREFIX}-verify`, createdById: 1 },
    });
    createdKeyIds.push(key.id);

    const row = await verifyApiKey({ token });
    expect(row?.id).toBe(key.id);
  });

  test("returns null for malformed tokens", async () => {
    const row = await verifyApiKey({ token: "not-an-os-key" });
    expect(row).toBeNull();
  });

  test("returns null for a prefix-match with wrong body", async () => {
    const { token, key } = await createApiKey({
      ctx: teamCtx,
      input: { name: `${TEST_PREFIX}-verify-wrong`, createdById: 1 },
    });
    createdKeyIds.push(key.id);

    // Swap the body after the prefix with another random hex sequence so
    // prefix hits but hash comparison fails.
    const wrong = `${token.slice(0, 11)}${"f".repeat(24)}`;
    const row = await verifyApiKey({ token: wrong });
    expect(row).toBeNull();
  });
});

describe("updateApiKeyLastUsed", () => {
  test("skips the write when lastUsedAt is recent", async () => {
    const { key } = await createApiKey({
      ctx: teamCtx,
      input: { name: `${TEST_PREFIX}-lastused`, createdById: 1 },
    });
    createdKeyIds.push(key.id);

    const now = new Date();
    const wrote = await updateApiKeyLastUsed({
      id: key.id,
      lastUsedAt: now,
    });
    expect(wrote).toBe(false);
  });

  test("writes when lastUsedAt is null or past the debounce window", async () => {
    const { key } = await createApiKey({
      ctx: teamCtx,
      input: { name: `${TEST_PREFIX}-lastused-null`, createdById: 1 },
    });
    createdKeyIds.push(key.id);

    const wrote = await updateApiKeyLastUsed({ id: key.id, lastUsedAt: null });
    expect(wrote).toBe(true);

    const row = await db
      .select({ lastUsedAt: apiKey.lastUsedAt })
      .from(apiKey)
      .where(eq(apiKey.id, key.id))
      .get();
    expect(row?.lastUsedAt).toBeInstanceOf(Date);
  });
});
