import { beforeAll, describe, expect, test } from "bun:test";

import { SEEDED_WORKSPACE_TEAM_ID } from "../../../test/fixtures";
import { loadSeededWorkspace, makeUserCtx } from "../../../test/helpers";
import type { ServiceContext } from "../../context";
import { agentTools } from "../index";

let teamCtx: ServiceContext;

beforeAll(async () => {
  const team = await loadSeededWorkspace(SEEDED_WORKSPACE_TEAM_ID);
  teamCtx = makeUserCtx(team, { userId: 1 });
});

describe("agent-tool shape equivalence", () => {
  test("list_status_pages output matches schema", async () => {
    const tool = agentTools.list_status_pages;
    const result = await tool.run({ ctx: teamCtx, input: {} });
    const parsed = tool.outputSchema.safeParse(result);
    expect(parsed.success, parsed.error?.message).toBe(true);
  });

  test("list_status_reports output matches schema", async () => {
    const tool = agentTools.list_status_reports;
    const result = await tool.run({
      ctx: teamCtx,
      input: { filter: "all", page: 1, perPage: 5 },
    });
    const parsed = tool.outputSchema.safeParse(result);
    expect(parsed.success, parsed.error?.message).toBe(true);
  });

  test("list_maintenances output matches schema", async () => {
    const tool = agentTools.list_maintenances;
    const result = await tool.run({
      ctx: teamCtx,
      input: { page: 1, perPage: 5 },
    });
    const parsed = tool.outputSchema.safeParse(result);
    expect(parsed.success, parsed.error?.message).toBe(true);
  });

  test("list_monitors output matches schema", async () => {
    const tool = agentTools.list_monitors;
    const result = await tool.run({
      ctx: teamCtx,
      input: { page: 1, perPage: 5 },
    });
    const parsed = tool.outputSchema.safeParse(result);
    expect(parsed.success, parsed.error?.message).toBe(true);
  });

  test("list_notifications output matches schema", async () => {
    const tool = agentTools.list_notifications;
    const result = await tool.run({
      ctx: teamCtx,
      input: { page: 1, perPage: 5 },
    });
    const parsed = tool.outputSchema.safeParse(result);
    expect(parsed.success, parsed.error?.message).toBe(true);
  });

  // Monitor-bound reads need an actual monitor id. The seeded team
  // workspace has monitor #1 (`OpenStatus`) — see packages/db/src/seed.mts.
  const SEEDED_TEAM_MONITOR_ID = 1;

  test("get_monitor output matches schema", async () => {
    const tool = agentTools.get_monitor;
    const result = await tool.run({
      ctx: teamCtx,
      input: { monitorId: SEEDED_TEAM_MONITOR_ID },
    });
    const parsed = tool.outputSchema.safeParse(result);
    expect(parsed.success, parsed.error?.message).toBe(true);
  });

  test("get_monitor_status output matches schema", async () => {
    const tool = agentTools.get_monitor_status;
    const result = await tool.run({
      ctx: teamCtx,
      input: { monitorId: SEEDED_TEAM_MONITOR_ID },
    });
    const parsed = tool.outputSchema.safeParse(result);
    expect(parsed.success, parsed.error?.message).toBe(true);
  });

  test("get_monitor_summary output matches schema", async () => {
    const tool = agentTools.get_monitor_summary;
    const result = await tool.run({
      ctx: teamCtx,
      input: { monitorId: SEEDED_TEAM_MONITOR_ID, timeRange: "1d" },
    });
    const parsed = tool.outputSchema.safeParse(result);
    expect(parsed.success, parsed.error?.message).toBe(true);
  });

  test("list_response_logs output matches schema", async () => {
    const tool = agentTools.list_response_logs;
    const result = await tool.run({
      ctx: teamCtx,
      input: {
        monitorId: SEEDED_TEAM_MONITOR_ID,
        timeRange: "1d",
        limit: 10,
        offset: 0,
      },
    });
    const parsed = tool.outputSchema.safeParse(result);
    expect(parsed.success, parsed.error?.message).toBe(true);
  });

  // get_response_log requires a Tinybird row; covered by RPC handler tests.
});
