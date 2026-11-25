import { and, db as defaultDb, desc, eq, sql } from "@openstatus/db";
import {
  integration,
  selectWorkspaceSchema,
  workspace,
} from "@openstatus/db/src/schema";
import { z } from "zod";

import type { DB } from "../context";
import type { Workspace } from "../types";

const integrationDataSchema = z.object({ scopes: z.string().optional() });

export interface SlackWorkspace {
  workspace: Workspace;
  botToken: string;
  botUserId: string;
  /** Comma list Slack granted at install; missing scopes mean "reconnect". */
  scopes?: string;
}

interface IntegrationCredential {
  botToken: string;
  botUserId: string;
}

function parseScopes(raw: string | null): string {
  try {
    return (
      integrationDataSchema.safeParse(JSON.parse(raw ?? "{}")).data?.scopes ??
      ""
    );
  } catch {
    return "";
  }
}

/**
 * The workspace a Slack team installed the agent into, with its bot token.
 * Cross-workspace by nature: an inbound Slack event carries only the team id.
 */
export async function resolveSlackTeamWorkspace(
  teamId: string,
  db: DB = defaultDb,
): Promise<SlackWorkspace | null> {
  const row = await db
    .select({
      workspaceId: integration.workspaceId,
      credential: integration.credential,
      // Raw text: the JSON-mode column throws on a malformed legacy row.
      rawData: sql<string | null>`${integration.data}`,
    })
    .from(integration)
    .where(
      and(
        eq(integration.name, "slack-agent"),
        eq(integration.externalId, teamId),
      ),
    )
    // Slack keeps one live token per (app, team); a reinstall invalidates all
    // earlier ones. If the team is linked to several workspaces, the newest row
    // is the only one holding a valid token.
    .orderBy(desc(integration.updatedAt))
    .get();

  if (!row?.workspaceId) return null;

  const credential = row.credential as IntegrationCredential | null;
  if (!credential?.botToken) return null;

  const ws = await db
    .select()
    .from(workspace)
    .where(eq(workspace.id, row.workspaceId))
    .get();

  if (!ws) return null;

  const parsed = selectWorkspaceSchema.safeParse(ws);
  if (!parsed.success) return null;

  return {
    workspace: parsed.data,
    botToken: credential.botToken,
    botUserId: credential.botUserId ?? "",
    scopes: parseScopes(row.rawData),
  };
}
