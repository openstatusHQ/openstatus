import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";

import {
  assertSafeUrl,
  assertSafeUrlSync,
  safeFetch,
  safeUrlSchema,
} from "./ssrf";

// --- assertSafeUrlSync (no DNS, used in Zod schemas) ---

describe("assertSafeUrlSync", () => {
  describe("allows valid public URLs", () => {
    const allowed = [
      "https://hooks.slack.com/services/T00/B00/xxx",
      "https://discord.com/api/webhooks/123/abc",
      "https://chat.googleapis.com/v1/spaces/xxx",
      "https://ntfy.sh/my-topic",
      "https://example.com/webhook",
      "http://example.com/webhook",
      "https://172.32.0.1/webhook", // 172.32 is NOT private (only 172.16-31)
      "https://172.15.255.255/webhook", // 172.15 is NOT private
    ];

    for (const url of allowed) {
      it(`allows ${url}`, () => {
        expect(() => assertSafeUrlSync(url)).not.toThrow();
      });
    }
  });

  describe("blocks non-HTTP protocols", () => {
    const blocked = [
      "ftp://example.com/file",
      "file:///etc/passwd",
      "gopher://evil.com/",
      "javascript:alert(1)",
      "data:text/html,<h1>hi</h1>",
    ];

    for (const url of blocked) {
      it(`blocks ${url}`, () => {
        expect(() => assertSafeUrlSync(url)).toThrow("not allowed");
      });
    }
  });

  describe("blocks private IPv4 addresses", () => {
    const blocked = [
      "http://127.0.0.1/",
      "http://127.0.0.1:8080/test",
      "http://10.0.0.1/",
      "http://10.255.255.255/",
      "http://172.16.0.1/",
      "http://172.31.255.255/",
      "http://192.168.0.1/",
      "http://192.168.1.100:3000/",
      "http://169.254.169.254/latest/meta-data/", // AWS metadata
      "http://0.0.0.0/",
    ];

    for (const url of blocked) {
      it(`blocks ${url}`, () => {
        expect(() => assertSafeUrlSync(url)).toThrow("not allowed");
      });
    }
  });

  describe("blocks private hostnames", () => {
    const blocked = [
      "http://localhost/",
      "http://localhost:8080/test",
      "http://LOCALHOST/", // case insensitive
      "http://metadata.google.internal/computeMetadata/v1/",
      "http://metadata.internal/",
    ];

    for (const url of blocked) {
      it(`blocks ${url}`, () => {
        expect(() => assertSafeUrlSync(url)).toThrow("not allowed");
      });
    }
  });

  describe("blocks IPv6 private addresses", () => {
    const blocked = [
      "http://[::1]/", // loopback
      "http://[::1]:8080/",
      "http://[fc00::1]/", // unique local
      "http://[fd12:3456::1]/", // unique local
      "http://[fe80::1]/", // link-local
    ];

    for (const url of blocked) {
      it(`blocks ${url}`, () => {
        expect(() => assertSafeUrlSync(url)).toThrow("not allowed");
      });
    }
  });

  describe("blocks IPv4-mapped IPv6 addresses", () => {
    it("blocks ::ffff:127.0.0.1 (dotted-quad form)", () => {
      expect(() => assertSafeUrlSync("http://[::ffff:127.0.0.1]/")).toThrow(
        "not allowed",
      );
    });

    it("blocks ::ffff:7f00:1 (hex form, Node URL parser output)", () => {
      // Node converts ::ffff:127.0.0.1 to ::ffff:7f00:1
      expect(() => assertSafeUrlSync("http://[::ffff:7f00:1]/")).toThrow(
        "not allowed",
      );
    });

    it("blocks ::ffff:a9fe:a9fe (169.254.169.254 AWS metadata in hex)", () => {
      expect(() => assertSafeUrlSync("http://[::ffff:a9fe:a9fe]/")).toThrow(
        "not allowed",
      );
    });

    it("blocks ::ffff:a00:1 (10.0.0.1 in hex)", () => {
      expect(() => assertSafeUrlSync("http://[::ffff:a00:1]/")).toThrow(
        "not allowed",
      );
    });

    it("blocks ::ffff:c0a8:1 (192.168.0.1 in hex)", () => {
      expect(() => assertSafeUrlSync("http://[::ffff:c0a8:1]/")).toThrow(
        "not allowed",
      );
    });
  });

  describe("rejects invalid URLs", () => {
    it("throws on empty string", () => {
      expect(() => assertSafeUrlSync("")).toThrow();
    });

    it("throws on garbage", () => {
      expect(() => assertSafeUrlSync("not-a-url")).toThrow();
    });
  });
});

// --- assertSafeUrl (async, same string-only checks) ---

describe("assertSafeUrl", () => {
  it("allows a valid public URL", async () => {
    await expect(
      assertSafeUrl("https://example.com/webhook"),
    ).resolves.toBeUndefined();
  });

  it("blocks localhost", async () => {
    await expect(assertSafeUrl("http://localhost/")).rejects.toThrow(
      "not allowed",
    );
  });

  it("blocks private IPs", async () => {
    await expect(assertSafeUrl("http://192.168.1.1/")).rejects.toThrow(
      "not allowed",
    );
  });

  it("blocks non-HTTP protocols", async () => {
    await expect(assertSafeUrl("ftp://example.com/")).rejects.toThrow(
      "not allowed",
    );
  });

  it("blocks AWS metadata endpoint", async () => {
    await expect(
      assertSafeUrl("http://169.254.169.254/latest/meta-data/"),
    ).rejects.toThrow("not allowed");
  });
});

// --- safeUrlSchema (Zod schema) ---

describe("safeUrlSchema", () => {
  it("accepts valid public URLs", () => {
    const result = safeUrlSchema.safeParse(
      "https://hooks.slack.com/services/T00/B00/xxx",
    );
    expect(result.success).toBe(true);
  });

  it("rejects non-URL strings", () => {
    const result = safeUrlSchema.safeParse("not-a-url");
    expect(result.success).toBe(false);
  });

  it("rejects private IPs", () => {
    const result = safeUrlSchema.safeParse("http://127.0.0.1/");
    expect(result.success).toBe(false);
  });

  it("rejects localhost", () => {
    const result = safeUrlSchema.safeParse("http://localhost:8080/");
    expect(result.success).toBe(false);
  });

  it("rejects metadata endpoint", () => {
    const result = safeUrlSchema.safeParse(
      "http://169.254.169.254/latest/meta-data/",
    );
    expect(result.success).toBe(false);
  });

  it("rejects ftp protocol", () => {
    const result = safeUrlSchema.safeParse("ftp://example.com/file");
    expect(result.success).toBe(false);
  });

  it("rejects IPv4-mapped IPv6 in hex form", () => {
    const result = safeUrlSchema.safeParse("http://[::ffff:7f00:1]/");
    expect(result.success).toBe(false);
  });
});

describe("safeFetch", () => {
  it("rejects a private target without fetching", async () => {
    const original = globalThis.fetch;
    let called = false;
    globalThis.fetch = () => {
      called = true;
      return Promise.resolve(new Response());
    };
    try {
      await expect(
        safeFetch("http://169.254.169.254/latest/meta-data"),
      ).rejects.toThrow();
      expect(called).toBe(false);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("does not follow a 302", async () => {
    const original = globalThis.fetch;
    let seen: RequestInit | undefined;
    globalThis.fetch = (_input, init) => {
      seen = init;
      return Promise.resolve(
        new Response(null, {
          status: 302,
          headers: { location: "http://169.254.169.254/" },
        }),
      );
    };
    try {
      const res = await safeFetch("https://example.com/hook", {
        method: "POST",
      });
      expect(seen?.redirect).toBe("manual");
      expect(res.ok).toBe(false);
    } finally {
      globalThis.fetch = original;
    }
  });

  function redirecting(hops: Record<string, [number, string]>) {
    const seen: string[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = (input) => {
      const url = String(input);
      seen.push(url);
      const hop = hops[url];
      return Promise.resolve(
        hop
          ? new Response(null, {
              status: hop[0],
              headers: { location: hop[1] },
            })
          : new Response("ok"),
      );
    };
    return { seen, restore: () => (globalThis.fetch = original) };
  }

  it("follows a same-host 307/308, e.g. an http to https upgrade", async () => {
    const { seen, restore } = redirecting({
      "http://example.com/hook": [308, "https://example.com/hook"],
      "https://example.com/hook": [307, "/v2/hook"],
    });
    try {
      const res = await safeFetch("http://example.com/hook", {
        method: "POST",
      });
      expect(res.ok).toBe(true);
      expect(seen).toEqual([
        "http://example.com/hook",
        "https://example.com/hook",
        "https://example.com/v2/hook",
      ]);
    } finally {
      restore();
    }
  });

  it("does not follow a 307 that would replay headers elsewhere", async () => {
    for (const location of [
      "https://evil.example/hook",
      "http://169.254.169.254/latest/meta-data",
      // downgrade to plaintext
      "http://example.com/hook",
      // same host, different service
      "https://example.com:8443/hook",
    ]) {
      const { seen, restore } = redirecting({
        "https://example.com/hook": [307, location],
      });
      try {
        const res = await safeFetch("https://example.com/hook");
        expect(res.ok).toBe(false);
        expect(seen).toEqual(["https://example.com/hook"]);
      } finally {
        restore();
      }
    }
  });

  it("stops after a bounded number of hops", async () => {
    const { seen, restore } = redirecting({
      "https://example.com/a": [307, "/b"],
      "https://example.com/b": [307, "/a"],
    });
    try {
      const res = await safeFetch("https://example.com/a");
      expect(res.ok).toBe(false);
      expect(seen.length).toBe(4);
    } finally {
      restore();
    }
  });
});
