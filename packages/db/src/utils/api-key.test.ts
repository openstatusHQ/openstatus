import { describe, expect, it } from "bun:test";
import {
  generateApiKey,
  hashApiKey,
  shouldUpdateLastUsed,
  verifyApiKeyHash,
} from "./api-key";

describe("API Key Utilities", () => {
  describe("generateApiKey", () => {
    it("should generate a token with correct format", () => {
      const { token, prefix, hash } = generateApiKey();

      // Token should start with "os_" and be 35 chars total (os_ + 32 hex)
      expect(token).toMatch(/^os_[a-f0-9]{32}$/);
      expect(token.length).toBe(35);
    });

    it("should generate a prefix with correct format", () => {
      const { prefix } = generateApiKey();

      // Prefix should be "os_" + 8 chars = 11 chars total
      expect(prefix).toMatch(/^os_[a-f0-9]{8}$/);
      expect(prefix.length).toBe(11);
    });

    it("should generate unique tokens", () => {
      const key1 = generateApiKey();
      const key2 = generateApiKey();

      expect(key1.token).not.toBe(key2.token);
      expect(key1.hash).not.toBe(key2.hash);
    });

    it("should generate prefix from token start", () => {
      const { token, prefix } = generateApiKey();

      expect(token.slice(0, 11)).toBe(prefix);
    });
  });

  describe("hashApiKey", () => {
    it("should generate hash that can verify the token", async () => {
      const { token, hash } = generateApiKey();

      expect(await verifyApiKeyHash(token, hash)).toBe(true);
    });
  });

  describe("hashApiKey", () => {
    it("should generate different hashes for different tokens", () => {
      const hash1 = hashApiKey("os_token1");
      const hash2 = hashApiKey("os_token2");

      expect(hash1).not.toBe(hash2);
    });

    it("should generate a valid bcrypt hash", () => {
      const hash = hashApiKey("os_test_token");

      // Bcrypt hashes start with $2a$, $2b$, or $2y$
      expect(hash).toMatch(/^\$2[aby]\$/);
    });

    it("should generate hash that can verify the original token", async () => {
      const token = "os_test_token_12345";
      const hash = hashApiKey(token);

      expect(await verifyApiKeyHash(token, hash)).toBe(true);
    });

    it("should generate different hashes for same token on multiple calls", async () => {
      const token = "os_same_token";
      const hash1 = hashApiKey(token);
      const hash2 = hashApiKey(token);

      // bcrypt uses salt, so same input produces different hashes
      expect(hash1).not.toBe(hash2);
      // But both should verify the token
      expect(await verifyApiKeyHash(token, hash1)).toBe(true);
      expect(await verifyApiKeyHash(token, hash2)).toBe(true);
    });
  });

  describe("verifyApiKeyHash", () => {
    it("should return true for valid bcrypt hash with correct token", async () => {
      const token = "os_valid_token_12345";
      const hash = hashApiKey(token);

      expect(await verifyApiKeyHash(token, hash)).toBe(true);
    });

    it("should return false for valid bcrypt hash with wrong token", async () => {
      const correctToken = "os_correct_token";
      const wrongToken = "os_wrong_token";
      const hash = hashApiKey(correctToken);

      expect(await verifyApiKeyHash(wrongToken, hash)).toBe(false);
    });

    it("should return false for non-bcrypt hash format", async () => {
      const token = "os_test_token";
      const invalidHash = "not_a_bcrypt_hash";

      expect(await verifyApiKeyHash(token, invalidHash)).toBe(false);
    });

    it("should return false for SHA-256 hash format", async () => {
      const token = "os_test_token";
      // SHA-256 hashes are 64 hex characters
      const sha256Hash =
        "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8";

      expect(await verifyApiKeyHash(token, sha256Hash)).toBe(false);
    });

    it("should return false for empty hash", async () => {
      const token = "os_test_token";

      expect(await verifyApiKeyHash(token, "")).toBe(false);
    });

    it("should return false for empty token with valid hash", async () => {
      const hash = hashApiKey("os_some_token");

      expect(await verifyApiKeyHash("", hash)).toBe(false);
    });

    it("should handle bcrypt hashes with different cost factors", async () => {
      const token = "os_test_token";
      const hash = hashApiKey(token);

      // Should work regardless of the $2a$, $2b$, or $2y$ variant
      expect(await verifyApiKeyHash(token, hash)).toBe(true);
    });
  });

  describe("shouldUpdateLastUsed", () => {
    it("should return true when lastUsedAt is null", () => {
      expect(shouldUpdateLastUsed(null)).toBe(true);
    });

    it("should return true when enough time has passed", () => {
      const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000);
      expect(shouldUpdateLastUsed(sixMinutesAgo, 5)).toBe(true);
    });

    it("should return false when not enough time has passed", () => {
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
      expect(shouldUpdateLastUsed(twoMinutesAgo, 5)).toBe(false);
    });

    it("should respect custom debounce period", () => {
      const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000);
      expect(shouldUpdateLastUsed(threeMinutesAgo, 2)).toBe(true);
      expect(shouldUpdateLastUsed(threeMinutesAgo, 4)).toBe(false);
    });

    it("should return false when just updated", () => {
      const justNow = new Date();
      expect(shouldUpdateLastUsed(justNow, 5)).toBe(false);
    });

    it("should handle boundary case at exact debounce time", () => {
      const exactlyFiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      // At exactly the debounce time, it should not update (needs to be > not >=)
      expect(shouldUpdateLastUsed(exactlyFiveMinutesAgo, 5)).toBe(false);
    });

    it("should handle boundary case just after debounce time", () => {
      const justOverFiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000 - 1);
      expect(shouldUpdateLastUsed(justOverFiveMinutesAgo, 5)).toBe(true);
    });

    it("should use default debounce of 5 minutes when not specified", () => {
      const fourMinutesAgo = new Date(Date.now() - 4 * 60 * 1000);
      const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000);

      expect(shouldUpdateLastUsed(fourMinutesAgo)).toBe(false);
      expect(shouldUpdateLastUsed(sixMinutesAgo)).toBe(true);
    });

    it("should handle zero debounce period", () => {
      const oneSecondAgo = new Date(Date.now() - 1000);
      expect(shouldUpdateLastUsed(oneSecondAgo, 0)).toBe(true);
    });

    it("should handle very long debounce periods", () => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      expect(shouldUpdateLastUsed(oneHourAgo, 120)).toBe(false); // 2 hours
      expect(shouldUpdateLastUsed(oneHourAgo, 30)).toBe(true); // 30 minutes
    });
  });
});
