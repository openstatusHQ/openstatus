import { selectWorkspaceSchema } from "@openstatus/db/src/schema";
import { createWorkspace } from "@openstatus/db/src/test/factories";
import { expect } from "@std/expect";
import { beforeAll, describe, test } from "@std/testing/bdd";

import { makeUserCtx, withTestTransaction } from "../../../test/helpers";
import type { ServiceContext } from "../../context";
import { ValidationError } from "../../errors";
import { createMonitor } from "../create";
import { updateMonitorConfig, updateMonitorGeneral } from "../update";

const TEST_PREFIX = "svc-monitor-url-safety";

let ctx: ServiceContext;

beforeAll(async () => {
  const ws = selectWorkspaceSchema.parse(await createWorkspace());
  ctx = makeUserCtx(ws, { userId: 1 });
});

const BLOCKED = [
  "http://localhost:3000",
  "http://127.0.0.1/health",
  "http://192.168.1.10/",
  "http://10.0.0.1/",
  "http://172.16.0.1/",
  "http://169.254.169.254/latest/meta-data/",
  "http://metadata.google.internal/",
  "http://[::1]/",
  "http://[::ffff:7f00:1]/",
];

function httpInput(url: string) {
  return {
    name: `${TEST_PREFIX}-monitor`,
    jobType: "http" as const,
    url,
    method: "GET" as const,
    headers: [],
    assertions: [],
    active: false,
  };
}

describe("monitor url SSRF guard", () => {
  test("createMonitor rejects private and internal http targets", async () => {
    for (const url of BLOCKED) {
      await withTestTransaction(async (tx) => {
        await expect(
          createMonitor({ ctx: { ...ctx, db: tx }, input: httpInput(url) }),
        ).rejects.toThrow(ValidationError);
      });
    }
  });

  test("createMonitor allows public http targets", async () => {
    await withTestTransaction(async (tx) => {
      const row = await createMonitor({
        ctx: { ...ctx, db: tx },
        input: httpInput("https://example.com/health"),
      });
      expect(row.url).toBe("https://example.com/health");
    });
  });

  test("tcp and dns monitors are not url-checked", async () => {
    await withTestTransaction(async (tx) => {
      const tcp = await createMonitor({
        ctx: { ...ctx, db: tx },
        input: { ...httpInput("127.0.0.1:8080"), jobType: "tcp" },
      });
      expect(tcp.url).toBe("127.0.0.1:8080");

      const dns = await createMonitor({
        ctx: { ...ctx, db: tx },
        input: { ...httpInput("localhost"), jobType: "dns" },
      });
      expect(dns.url).toBe("localhost");
    });
  });

  test("updateMonitorGeneral rejects a private target", async () => {
    await withTestTransaction(async (tx) => {
      const created = await createMonitor({
        ctx: { ...ctx, db: tx },
        input: httpInput("https://example.com"),
      });

      await expect(
        updateMonitorGeneral({
          ctx: { ...ctx, db: tx },
          input: {
            id: created.id,
            name: created.name,
            jobType: "http",
            url: "http://127.0.0.1:8080",
            method: "GET",
            headers: [],
            assertions: [],
            active: false,
          },
        }),
      ).rejects.toThrow(ValidationError);
    });
  });

  test("updateMonitorConfig rejects a private target using the stored jobType", async () => {
    await withTestTransaction(async (tx) => {
      const created = await createMonitor({
        ctx: { ...ctx, db: tx },
        input: httpInput("https://example.com"),
      });

      await expect(
        updateMonitorConfig({
          ctx: { ...ctx, db: tx },
          input: { id: created.id, url: "http://localhost:3000" },
        }),
      ).rejects.toThrow(ValidationError);
    });
  });

  test("updateMonitorConfig leaves tcp urls alone", async () => {
    await withTestTransaction(async (tx) => {
      const created = await createMonitor({
        ctx: { ...ctx, db: tx },
        input: { ...httpInput("example.com:443"), jobType: "tcp" },
      });

      const updated = await updateMonitorConfig({
        ctx: { ...ctx, db: tx },
        input: { id: created.id, url: "10.0.0.5:8080" },
      });

      expect(updated.url).toBe("10.0.0.5:8080");
    });
  });
});
