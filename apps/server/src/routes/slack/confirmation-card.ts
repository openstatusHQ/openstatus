import type { ServiceContext } from "@openstatus/services";
import type { WebClient } from "@slack/web-api";

import {
  buildConfirmationBlocks,
  getConfirmationText,
  type RefResolvers,
} from "./blocks";
import { store } from "./confirmation-store";
import {
  getComponentNames,
  getPageDashboardLink,
  getStatusReportLink,
} from "./page-urls";
import { deriveDraftSchema, getRegistryTool } from "./registry-runner";

export function makeRefResolvers(workspaceId: number): RefResolvers {
  return {
    page: (pageId) => getPageDashboardLink(workspaceId, pageId),
    statusReport: (statusReportId) =>
      getStatusReportLink(workspaceId, statusReportId),
    componentNames: (ids) => getComponentNames(workspaceId, ids),
  };
}

/**
 * Posts an approval card for a registry write outside an agent turn (slash
 * commands, follow-ups). Nothing runs until the initiator clicks Approve.
 */
export async function postConfirmationCard(args: {
  slack: WebClient;
  ctx: ServiceContext;
  teamId: string;
  channel: string;
  threadTs?: string;
  slackUserId: string;
  toolName: string;
  input: object;
}): Promise<void> {
  const { slack, ctx, teamId, channel, slackUserId, toolName } = args;
  const tool = getRegistryTool(toolName);
  if (!tool) throw new Error(`slack: unknown tool "${toolName}"`);

  const input = deriveDraftSchema(tool).parse(args.input);
  const displayInput = tool.approval?.prepareDraftInput
    ? await tool.approval.prepareDraftInput({ ctx, input })
    : input;
  const text = getConfirmationText({ tool, input: displayInput });

  const posted = await slack.chat.postMessage({
    channel,
    text,
    ...(args.threadTs ? { thread_ts: args.threadTs } : {}),
  });
  if (!posted.ts) throw new Error("chat.postMessage returned no ts");

  const actionId = await store({
    workspaceId: ctx.workspace.id,
    teamId,
    channelId: channel,
    threadTs: args.threadTs ?? posted.ts,
    messageTs: posted.ts,
    userId: slackUserId,
    payload: { toolName, input },
  });
  const blocks = await buildConfirmationBlocks({
    actionId,
    tool,
    input: displayInput,
    resolvers: makeRefResolvers(ctx.workspace.id),
  });
  await slack.chat.update({ channel, ts: posted.ts, text, blocks });
}
