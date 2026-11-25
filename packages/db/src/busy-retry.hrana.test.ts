import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

import { createClient } from "@libsql/client/http";
import { describe, expect, test } from "vitest";

import { withBusyRetryClient } from "./busy-retry";

const okResult = {
  type: "ok",
  response: {
    type: "execute",
    result: {
      cols: [],
      rows: [],
      affected_row_count: 0,
      last_insert_rowid: null,
    },
  },
};

// A second connection can hold the write lock when a statement arrives, and
// sqld answers with SQLITE_BUSY. The wrapped client must repeat that statement.
describe("withBusyRetryClient against a busy server", () => {
  test("repeats a statement the server refused with SQLITE_BUSY", async () => {
    let requests = 0;
    const server = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", () => {
        const body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
        const count = Array.isArray(body.requests) ? body.requests.length : 0;
        requests++;
        const busy = {
          type: "error",
          error: {
            message: "SQLite error: database is locked",
            code: "SQLITE_BUSY",
          },
        };
        const results = Array.from({ length: count }, () =>
          requests === 1 ? busy : okResult,
        );
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ baton: null, base_url: null, results }));
      });
    });

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as AddressInfo;

    try {
      const client = withBusyRetryClient(
        createClient({ url: `http://127.0.0.1:${port}` }),
      );

      const result = await client.execute(
        "insert into monitor (name) values ('a')",
      );

      expect(result.rows).toEqual([]);
      expect(requests).toBe(2);
    } finally {
      server.close();
    }
  });
});
