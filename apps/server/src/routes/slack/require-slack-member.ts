import type { Workspace } from "@openstatus/db/src/schema/workspaces/validation";
import { signSlackLinkToken } from "@openstatus/services/slack-user";
import type { WebClient } from "@slack/web-api";

import { redis } from "@/libs/clients";

import type { SlackConfig } from "./config";
import { resolveSlackMember } from "./resolve-slack-user";

export type SlackActor = {
  type: "slack";
  teamId: string;
  slackUserId: string;
  userId: number;
};

const LINK_CARD_WINDOW_SECONDS = 10 * 60;

/** The Slack actor for a linked member, or `null` for anyone else. */
export async function requireSlackMember(args: {
  workspace: Workspace;
  teamId: string;
  slackUserId: string;
  slack: WebClient;
}): Promise<SlackActor | null> {
  const userId = await resolveSlackMember(args);
  if (userId === null) return null;
  return {
    type: "slack",
    teamId: args.teamId,
    slackUserId: args.slackUserId,
    userId,
  };
}

export async function linkAccountUrl(
  config: SlackConfig,
  input: { workspaceId: number; teamId: string; slackUserId: string },
): Promise<string> {
  if (!config.signingSecret) {
    throw new Error("Slack signing secret not configured");
  }
  const token = await signSlackLinkToken(config.signingSecret, input);
  const params = new URLSearchParams({ token });
  return `${config.dashboardUrl}/settings/integrations/slack/link?${params.toString()}`;
}

function linkCardKey(teamId: string, slackUserId: string): string {
  return `slack:linkcard:${teamId}:${slackUserId}`;
}

/** Claims the per-user link-card window; `false` means one was sent recently. */
export async function claimLinkCardWindow(
  teamId: string,
  slackUserId: string,
): Promise<boolean> {
  const claimed = await redis.set(linkCardKey(teamId, slackUserId), "1", {
    nx: true,
    ex: LINK_CARD_WINDOW_SECONDS,
  });
  return claimed !== null;
}

/** Claims the per-user plan-notice window, kept apart from the link card's. */
export async function claimPlanNoticeWindow(
  teamId: string,
  slackUserId: string,
): Promise<boolean> {
  const claimed = await redis.set(
    `slack:plannotice:${teamId}:${slackUserId}`,
    "1",
    { nx: true, ex: LINK_CARD_WINDOW_SECONDS },
  );
  return claimed !== null;
}

/** Frees the window again when the card never made it out. */
export async function releaseLinkCardWindow(
  teamId: string,
  slackUserId: string,
): Promise<void> {
  await redis.del(linkCardKey(teamId, slackUserId));
}

export function slackAgentAllowed(workspace: Workspace): boolean {
  return workspace.limits["slack-agent"] === true;
}

export function planRequiredMessage(config: SlackConfig): { text: string } {
  return {
    text: `openstatus in Slack isn't included in this workspace's plan. <${config.dashboardUrl}/settings/billing|Upgrade> to use it.`,
  };
}
