import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { db, eq } from "@openstatus/db";
import { apiKey } from "@openstatus/db/src/schema";
import { verifyApiKeyHash } from "@openstatus/db/src/utils/api-key";

import {
  createApiKey,
  getApiKeys,
  revokeApiKey,
  updateLastUsed,
  verifyApiKey,
} from "./apiKey";

// Test data setup
let testWorkspaceId: number;
let testUserId: number;
let testApiKeyId: number;
let testToken: string;

beforeAll(async () => {
  // Clean up any existing test data
  await db.delete(apiKey).where(eq(apiKey.name, "Test API Key"));
  await db.delete(apiKey).where(eq(apiKey.name, "Test Key with Description"));
  await db.delete(apiKey).where(eq(apiKey.name, "Test Key with Expiration"));

  // Use existing test workspace and user from seed data
  testWorkspaceId = 1;
  testUserId = 1;
});

afterAll(async () => {
  // Clean up test data
  await db.delete(apiKey).where(eq(apiKey.name, "Test API Key"));
  await db.delete(apiKey).where(eq(apiKey.name, "Test Key with Description"));
  await db.delete(apiKey).where(eq(apiKey.name, "Test Key with Expiration"));
});

describe("createApiKey", () => {
  test("should create API key with minimal parameters", async () => {
    const result = await createApiKey(
      testWorkspaceId,
      testUserId,
      "Test API Key",
    );

    expect(result).toBeDefined();
    expect(result.token).toMatch(/^os_[a-f0-9]{32}$/);
    expect(result.key).toMatchObject({
      name: "Test API Key",
      workspaceId: testWorkspaceId,
      createdById: testUserId,
      description: null,
      expiresAt: null,
    });
    expect(result.key.prefix).toBe(result.token.slice(0, 11));
    expect(await verifyApiKeyHash(result.token, result.key.hashedToken)).toBe(true);

    // Save for later tests
    testApiKeyId = result.key.id;
    testToken = result.token;
  });

  test("should create API key with description", async () => {
    const description = "This is a test API key for integration testing";
    const result = await createApiKey(
      testWorkspaceId,
      testUserId,
      "Test Key with Description",
      description,
    );

    expect(result.key.description).toBe(description);
  });

  test("should create API key with expiration", async () => {
    const expiresAt = new Date(Date.now() + 86400000); // 1 day from now
    const result = await createApiKey(
      testWorkspaceId,
      testUserId,
      "Test Key with Expiration",
      undefined,
      expiresAt,
    );

    // SQLite stores timestamps with second precision, so compare with tolerance
    expect(result.key.expiresAt?.getTime()).toBeCloseTo(
      expiresAt.getTime(),
      -4,
    );
  });

  test("should create API key with both description and expiration", async () => {
    const description = "Full featured key";
    const expiresAt = new Date(Date.now() + 86400000);
    const result = await createApiKey(
      testWorkspaceId,
      testUserId,
      "Full Featured Key",
      description,
      expiresAt,
    );

    expect(result.key).toMatchObject({
      name: "Full Featured Key",
      description,
      expiresAt,
    });

    // Clean up
    await db.delete(apiKey).where(eq(apiKey.id, result.key.id));
  });

  test("should generate unique tokens", async () => {
    const result1 = await createApiKey(
      testWorkspaceId,
      testUserId,
      "Unique Key 1",
    );
    const result2 = await createApiKey(
      testWorkspaceId,
      testUserId,
      "Unique Key 2",
    );

    expect(result1.token).not.toBe(result2.token);
    expect(result1.key.prefix).not.toBe(result2.key.prefix);
    expect(result1.key.hashedToken).not.toBe(result2.key.hashedToken);

    // Clean up
    await db.delete(apiKey).where(eq(apiKey.id, result1.key.id));
    await db.delete(apiKey).where(eq(apiKey.id, result2.key.id));
  });
});

describe("verifyApiKey", () => {
  test("should verify valid API key", async () => {
    const result = await verifyApiKey(testToken);

    expect(result).not.toBeNull();
    expect(result).toMatchObject({
      id: testApiKeyId,
      name: "Test API Key",
      workspaceId: testWorkspaceId,
      createdById: testUserId,
    });
  });

  test("should return null for invalid token format", async () => {
    const invalidToken = "os_invalid";
    const result = await verifyApiKey(invalidToken);

    expect(result).toBeNull();
  });

  test("should return null for non-existent token", async () => {
    const nonExistentToken = `os_${"a".repeat(32)}`;
    const result = await verifyApiKey(nonExistentToken);

    expect(result).toBeNull();
  });

  test("should return null for token with incorrect hash", async () => {
    // Create a token with same prefix but different hash
    const wrongToken = testToken.slice(0, 11) + "0".repeat(24);
    const result = await verifyApiKey(wrongToken);

    expect(result).toBeNull();
  });

  test("should return null for expired token", async () => {
    // Create an expired key
    const expiredDate = new Date(Date.now() - 86400000); // 1 day ago
    const expiredKey = await createApiKey(
      testWorkspaceId,
      testUserId,
      "Expired Key",
      undefined,
      expiredDate,
    );

    const result = await verifyApiKey(expiredKey.token);

    expect(result).toBeNull();

    // Clean up
    await db.delete(apiKey).where(eq(apiKey.id, expiredKey.key.id));
  });

  test("should verify token that expires in the future", async () => {
    // Create a key that expires in the future
    const futureDate = new Date(Date.now() + 86400000); // 1 day from now
    const futureKey = await createApiKey(
      testWorkspaceId,
      testUserId,
      "Future Expiry Key",
      undefined,
      futureDate,
    );

    const result = await verifyApiKey(futureKey.token);

    expect(result).not.toBeNull();
    expect(result?.id).toBe(futureKey.key.id);

    // Clean up
    await db.delete(apiKey).where(eq(apiKey.id, futureKey.key.id));
  });
});

describe("revokeApiKey", () => {
  test("should revoke API key successfully", async () => {
    // Create a key to revoke
    const keyToRevoke = await createApiKey(
      testWorkspaceId,
      testUserId,
      "Key to Revoke",
    );

    const result = await revokeApiKey(keyToRevoke.key.id, testWorkspaceId);

    expect(result).toBe(true);

    // Verify key is deleted
    const deletedKey = await db
      .select()
      .from(apiKey)
      .where(eq(apiKey.id, keyToRevoke.key.id))
      .get();

    expect(deletedKey).toBeUndefined();
  });

  test("should return false for non-existent key", async () => {
    const result = await revokeApiKey(999999, testWorkspaceId);

    expect(result).toBe(false);
  });

  test("should return false when workspace ID doesn't match", async () => {
    // Create a key
    const key = await createApiKey(testWorkspaceId, testUserId, "Test Key");

    // Try to revoke with wrong workspace ID
    const result = await revokeApiKey(key.key.id, 999);

    expect(result).toBe(false);

    // Verify key still exists
    const stillExists = await db
      .select()
      .from(apiKey)
      .where(eq(apiKey.id, key.key.id))
      .get();

    expect(stillExists).toBeDefined();

    // Clean up
    await db.delete(apiKey).where(eq(apiKey.id, key.key.id));
  });
});

describe("getApiKeys", () => {
  test("should get all API keys for a workspace", async () => {
    // Create multiple keys
    const key1 = await createApiKey(
      testWorkspaceId,
      testUserId,
      "Workspace Key 1",
    );
    const key2 = await createApiKey(
      testWorkspaceId,
      testUserId,
      "Workspace Key 2",
    );
    const key3 = await createApiKey(
      testWorkspaceId,
      testUserId,
      "Workspace Key 3",
    );

    const keys = await getApiKeys(testWorkspaceId);

    // Should include at least the 3 keys we just created plus the test key from earlier
    expect(keys.length).toBeGreaterThanOrEqual(4);
    expect(keys.some((k) => k.name === "Workspace Key 1")).toBe(true);
    expect(keys.some((k) => k.name === "Workspace Key 2")).toBe(true);
    expect(keys.some((k) => k.name === "Workspace Key 3")).toBe(true);

    // All keys should belong to the test workspace
    keys.forEach((key) => {
      expect(key.workspaceId).toBe(testWorkspaceId);
    });

    // Clean up
    await db.delete(apiKey).where(eq(apiKey.id, key1.key.id));
    await db.delete(apiKey).where(eq(apiKey.id, key2.key.id));
    await db.delete(apiKey).where(eq(apiKey.id, key3.key.id));
  });

  test("should return empty array for workspace with no keys", async () => {
    // Use a non-existent workspace ID
    const keys = await getApiKeys(999999);

    expect(keys).toEqual([]);
  });

  test("should not include keys from other workspaces", async () => {
    // Assuming there might be other workspaces, verify isolation
    const keys = await getApiKeys(testWorkspaceId);

    keys.forEach((key) => {
      expect(key.workspaceId).toBe(testWorkspaceId);
    });
  });
});

describe("updateLastUsed", () => {
  test("should update lastUsedAt when never used", async () => {
    const key = await createApiKey(
      testWorkspaceId,
      testUserId,
      "Never Used Key",
    );

    const result = await updateLastUsed(key.key.id, null);

    expect(result).toBe(true);

    // Verify the update
    const updatedKey = await db
      .select()
      .from(apiKey)
      .where(eq(apiKey.id, key.key.id))
      .get();

    expect(updatedKey?.lastUsedAt).not.toBeNull();
    expect(updatedKey?.lastUsedAt).toBeInstanceOf(Date);

    // Clean up
    await db.delete(apiKey).where(eq(apiKey.id, key.key.id));
  });

  test("should update lastUsedAt when debounce period has passed", async () => {
    const key = await createApiKey(
      testWorkspaceId,
      testUserId,
      "Debounce Test Key",
    );

    // Set lastUsedAt to 10 minutes ago (beyond 5-minute debounce)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    await db
      .update(apiKey)
      .set({ lastUsedAt: tenMinutesAgo })
      .where(eq(apiKey.id, key.key.id));

    const result = await updateLastUsed(key.key.id, tenMinutesAgo);

    expect(result).toBe(true);

    // Verify the update
    const updatedKey = await db
      .select()
      .from(apiKey)
      .where(eq(apiKey.id, key.key.id))
      .get();

    expect(updatedKey?.lastUsedAt?.getTime()).toBeGreaterThan(
      tenMinutesAgo.getTime(),
    );

    // Clean up
    await db.delete(apiKey).where(eq(apiKey.id, key.key.id));
  });

  test("should not update lastUsedAt within debounce period", async () => {
    const key = await createApiKey(
      testWorkspaceId,
      testUserId,
      "Recent Use Key",
    );

    // Set lastUsedAt to 2 minutes ago (within 5-minute debounce)
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    await db
      .update(apiKey)
      .set({ lastUsedAt: twoMinutesAgo })
      .where(eq(apiKey.id, key.key.id));

    const result = await updateLastUsed(key.key.id, twoMinutesAgo);

    expect(result).toBe(false);

    // Verify no update occurred (compare with tolerance due to SQLite timestamp precision)
    const updatedKey = await db
      .select()
      .from(apiKey)
      .where(eq(apiKey.id, key.key.id))
      .get();

    expect(updatedKey?.lastUsedAt?.getTime()).toBeCloseTo(
      twoMinutesAgo.getTime(),
      -4,
    );

    // Clean up
    await db.delete(apiKey).where(eq(apiKey.id, key.key.id));
  });

  test("should update at exactly 5 minutes (boundary test)", async () => {
    const key = await createApiKey(
      testWorkspaceId,
      testUserId,
      "Boundary Test Key",
    );

    // Set lastUsedAt to exactly 5 minutes and 1ms ago
    const fiveMinutesAgo = new Date(Date.now() - (5 * 60 * 1000 + 1));
    await db
      .update(apiKey)
      .set({ lastUsedAt: fiveMinutesAgo })
      .where(eq(apiKey.id, key.key.id));

    const result = await updateLastUsed(key.key.id, fiveMinutesAgo);

    expect(result).toBe(true);

    // Clean up
    await db.delete(apiKey).where(eq(apiKey.id, key.key.id));
  });
});
