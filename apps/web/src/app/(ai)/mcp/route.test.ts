import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import { GET, MCP_TRANSPORT_URL, POST } from "./route";

describe("/mcp discovery", () => {
  test("serves the server card to JSON clients", async () => {
    const res = GET(
      new Request("https://www.openstatus.dev/mcp", {
        headers: { accept: "application/json" },
      }),
    );
    expect(res.status).toBe(200);
    const card = await res.json();
    expect(card.transport.url).toBe(MCP_TRANSPORT_URL);
    expect(card.capabilities.resources).toBeDefined();
    expect(card.resources.length).toBeGreaterThan(0);
  });

  test("sends browsers to the human-readable page", () => {
    const res = GET(
      new Request("https://www.openstatus.dev/mcp", {
        headers: { accept: "text/html" },
      }),
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(
      "https://www.openstatus.dev/tooling/mcp-server",
    );
  });

  test("forwards a streamable GET to the transport", () => {
    const res = GET(
      new Request("https://www.openstatus.dev/mcp", {
        headers: { accept: "text/event-stream" },
      }),
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(MCP_TRANSPORT_URL);
  });

  // 307 rather than 302 is what keeps the method and body intact.
  test("forwards a JSON-RPC POST to the transport with a 307", () => {
    const res = POST();
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(MCP_TRANSPORT_URL);
  });
});
