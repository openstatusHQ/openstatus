import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { Workspace } from "@openstatus/db/src/schema";
import type { ServiceContext } from "@openstatus/services";
import { describe, expect, test } from "vitest";

import { createMcpServer } from "../server";
import { MONITOR_CHART_URI, UI_RESOURCE_MIME_TYPE } from "../ui-resources";

const workspace = {
  id: 1,
  slug: "ws",
  name: "ws",
  limits: {},
} as unknown as Workspace;

function ctx(scopes: string[]): ServiceContext {
  return {
    workspace,
    actor: { type: "mcp", keyId: "k", scopes: scopes as never },
  };
}

async function connect(scopes: string[], experimental: boolean) {
  const server = createMcpServer(ctx(scopes), { experimental });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "0.0.0" });
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  return client;
}

describe("render_monitor_chart registration", () => {
  test("is absent unless the experimental surface is requested", async () => {
    const client = await connect(["read"], false);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).not.toContain("render_monitor_chart");
    const { resources } = await client.listResources();
    expect(resources.map((r) => r.uri)).not.toContain(MONITOR_CHART_URI);
  });

  test("links the tool to a readable MCP App resource", async () => {
    const client = await connect(["monitors:read"], true);
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === "render_monitor_chart");
    expect(tool?._meta).toEqual({
      ui: { resourceUri: MONITOR_CHART_URI },
      "ui/resourceUri": MONITOR_CHART_URI,
    });
    expect(tool?.annotations?.readOnlyHint).toBe(true);

    const { contents } = await client.readResource({ uri: MONITOR_CHART_URI });
    expect(contents[0]?.mimeType).toBe(UI_RESOURCE_MIME_TYPE);
    const html = contents[0] && "text" in contents[0] ? contents[0].text : "";
    expect(html).toContain("<!doctype html>");
    expect(html).not.toContain("/*__SCRIPT__*/");
  });

  test("is hidden from a key without monitors:read", async () => {
    const client = await connect(["pages:read"], true);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).not.toContain("render_monitor_chart");
  });
});
