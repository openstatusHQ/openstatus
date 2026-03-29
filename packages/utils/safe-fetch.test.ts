import { describe, expect, it } from "bun:test";
import { validateUrl } from "./safe-fetch";

describe("validateUrl", () => {
  it("blocks localhost", async () => {
    await expect(validateUrl("http://127.0.0.1/test")).rejects.toThrow(
      "private/internal",
    );
    await expect(validateUrl("http://127.0.0.2:8080/path")).rejects.toThrow(
      "private/internal",
    );
  });

  it("blocks 10.x.x.x range", async () => {
    await expect(validateUrl("http://10.0.0.1/")).rejects.toThrow(
      "private/internal",
    );
    await expect(validateUrl("http://10.255.255.255/")).rejects.toThrow(
      "private/internal",
    );
  });

  it("blocks 172.16-31.x.x range", async () => {
    await expect(validateUrl("http://172.16.0.1/")).rejects.toThrow(
      "private/internal",
    );
    await expect(validateUrl("http://172.31.255.255/")).rejects.toThrow(
      "private/internal",
    );
  });

  it("allows 172.32.x.x (not private)", async () => {
    // 172.32.x.x is not in the private range, so validateUrl should not throw
    // about private IPs (it may throw DNS errors which is fine)
    try {
      await validateUrl("http://172.32.0.1/");
    } catch (e) {
      expect((e as Error).message).not.toContain("private/internal");
    }
  });

  it("blocks 192.168.x.x range", async () => {
    await expect(validateUrl("http://192.168.1.1/")).rejects.toThrow(
      "private/internal",
    );
  });

  it("blocks link-local / metadata endpoint", async () => {
    await expect(
      validateUrl("http://169.254.169.254/latest/meta-data/"),
    ).rejects.toThrow("private/internal");
  });

  it("blocks 0.x.x.x range", async () => {
    await expect(validateUrl("http://0.0.0.0/")).rejects.toThrow(
      "private/internal",
    );
  });

  it("blocks IPv6 loopback", async () => {
    await expect(validateUrl("http://[::1]/")).rejects.toThrow(
      "private/internal",
    );
  });

  it("blocks non-http protocols", async () => {
    await expect(validateUrl("ftp://example.com/file")).rejects.toThrow(
      "Blocked protocol",
    );
    await expect(validateUrl("file:///etc/passwd")).rejects.toThrow(
      "Blocked protocol",
    );
  });

  it("rejects invalid URLs", async () => {
    await expect(validateUrl("not-a-url")).rejects.toThrow("Invalid URL");
  });

  it("allows public IPs", async () => {
    // 8.8.8.8 is a public IP, should not be blocked
    await expect(validateUrl("https://8.8.8.8")).resolves.toBeUndefined();
  });
});
