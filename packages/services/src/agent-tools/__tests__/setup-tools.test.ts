import { describe, expect, test } from "vitest";
import { ZodObject } from "zod";

import { agentTools, buildAgentSystemPrompt } from "../index";

const setupTools = [
  agentTools.create_monitor,
  agentTools.create_status_page,
  agentTools.add_page_component,
];

describe("setup agent tools", () => {
  test("declare group write scopes and approval", () => {
    expect(agentTools.create_monitor.scope).toBe("monitors:write");
    expect(agentTools.create_status_page.scope).toBe("pages:write");
    expect(agentTools.add_page_component.scope).toBe("pages:write");
    for (const t of setupTools) {
      expect(t.destructive, t.name).toBe(true);
      expect(t.approval?.summarize, t.name).toBeDefined();
    }
  });

  test("read tools moved to group read scopes", () => {
    expect(agentTools.list_monitors.scope).toBe("monitors:read");
    expect(agentTools.get_monitor.scope).toBe("monitors:read");
    expect(agentTools.list_status_pages.scope).toBe("pages:read");
    expect(agentTools.list_page_components.scope).toBe("pages:read");
  });

  // The MCP adapter needs `.shape`; a union root would register nothing.
  test("schemas are flat ZodObjects", () => {
    for (const t of setupTools) {
      expect(t.inputSchema, `${t.name} input`).toBeInstanceOf(ZodObject);
      expect(t.outputSchema, `${t.name} output`).toBeInstanceOf(ZodObject);
    }
  });

  test("create_monitor defaults to GET and active", () => {
    const parsed = agentTools.create_monitor.inputSchema.parse({
      name: "API",
      url: "https://api.acme.com",
      jobType: "http",
    });
    expect(parsed.method).toBe("GET");
    expect(parsed.active).toBe(true);
    expect(parsed.regions).toBeUndefined();
    expect(parsed.periodicity).toBeUndefined();
  });

  test("create_monitor accepts assertions and rejects other job types", () => {
    const schema = agentTools.create_monitor.inputSchema;
    expect(
      schema.safeParse({
        name: "API",
        url: "https://api.acme.com",
        jobType: "http",
        assertions: [{ type: "status", compare: "eq", target: 200 }],
      }).success,
    ).toBe(true);
    expect(
      schema.safeParse({ name: "x", url: "x", jobType: "icmp" }).success,
    ).toBe(false);
  });

  test("create_status_page normalises the slug", () => {
    const schema = agentTools.create_status_page.inputSchema;
    expect(schema.parse({ title: "Acme", slug: "Acme-Status" }).slug).toBe(
      "acme-status",
    );
    expect(schema.safeParse({ title: "Acme", slug: "ab" }).success).toBe(false);
    expect(schema.safeParse({ title: "Acme", slug: "a b" }).success).toBe(
      false,
    );
  });

  test("add_page_component needs both ids", () => {
    const schema = agentTools.add_page_component.inputSchema;
    expect(schema.safeParse({ pageId: 1 }).success).toBe(false);
    expect(schema.safeParse({ pageId: 1, monitorId: 2 }).success).toBe(true);
  });

  test("summaries carry the fields the Slack card shows", () => {
    const monitor = agentTools.create_monitor.approval?.summarize({
      name: "API",
      url: "https://api.acme.com",
      jobType: "http",
      method: "GET",
      active: true,
    });
    expect(monitor?.title).toBe("Create Monitor: API");
    expect(monitor?.lines.map((l) => l.label)).toEqual([
      "Name",
      "URL",
      "Type",
      "Periodicity",
    ]);
    expect(monitor?.lines.at(-1)?.value).toBe("plan default");

    const page = agentTools.create_status_page.approval?.summarize({
      title: "Acme",
      slug: "acme",
    });
    expect(page?.lines.map((l) => l.value)).toEqual(["Acme", "acme"]);

    const component = agentTools.add_page_component.approval?.summarize({
      pageId: 3,
      monitorId: 12,
    });
    expect(component?.lines[0]?.ref).toEqual({ kind: "page", pageId: 3 });
  });

  test("prompt names the setup tools and the limit rule", () => {
    const prompt = buildAgentSystemPrompt({
      workspaceName: "Test",
      surface: "dashboard",
      canNotifySubscribers: true,
    });
    expect(prompt).toContain("Setup (create_monitor");
    expect(prompt).toContain("Never retry the same call");
    expect(prompt).toContain("firstCheck");
    expect(prompt).toMatch(
      /Write tools \(create_monitor, create_status_page, add_page_component/,
    );
  });
});
