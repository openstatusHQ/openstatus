import { describe, expect, it } from "bun:test";
import { generateApiKey, hashApiKey, shouldUpdateLastUsed } from "./api-key";

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

    it("should generate a valid SHA-256 hash", () => {
      const { hash } = generateApiKey();

      // SHA-256 hash should be 64 hex characters
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
      expect(hash.length).toBe(64);
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
    it("should generate consistent hash for same token", () => {
      const token = "os_test123456789abcdef0123456789";
      const hash1 = hashApiKey(token);
      const hash2 = hashApiKey(token);

      expect(hash1).toBe(hash2);
    });

    it("should generate different hashes for different tokens", () => {
      const hash1 = hashApiKey("os_token1");
      const hash2 = hashApiKey("os_token2");

      expect(hash1).not.toBe(hash2);
    });

    it("should match hash from generateApiKey", () => {
      const { token, hash } = generateApiKey();
      const recomputedHash = hashApiKey(token);

      expect(recomputedHash).toBe(hash);
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
  });
});
