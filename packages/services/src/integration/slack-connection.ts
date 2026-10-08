import { and, desc, eq, sql } from "@openstatus/db";
import { integration } from "@openstatus/db/src/schema";
import { z } from "zod";

import { type ServiceContext, getReadDb } from "../context";
import { missingSlackScopes } from "./slack-scopes";

const credentialSchema = z.object({
  botToken: z.string().min(1),
  botUserId: z.string().optional(),
});
const dataSchema = z.object({ scopes: z.string().optional() });

export type SlackConnection = {
  teamId: string;
  botToken: string;
  botUserId: string | null;
  missingScopes: string[];
};

/** JSON-mode columns throw on malformed JSON when Drizzle maps the row. */
function parseJson(value: string | null): unknown {
  if (!value) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

/** The workspace's Slack agent install, bot token included. Server-side only. */
export async function getSlackConnection(args: {
  ctx: ServiceContext;
}): Promise<SlackConnection | null> {
  const row = await getReadDb(args.ctx)
    .select({
      externalId: integration.externalId,
      rawCredential: sql<string | null>`${integration.credential}`,
      rawData: sql<string | null>`${integration.data}`,
    })
    .from(integration)
    .where(
      and(
        eq(integration.name, "slack-agent"),
        eq(integration.workspaceId, args.ctx.workspace.id),
      ),
    )
    .orderBy(desc(integration.updatedAt), desc(integration.id))
    .get();
  if (!row) return null;
  const credential = credentialSchema.safeParse(parseJson(row.rawCredential));
  if (!credential.success) return null;
  return {
    teamId: row.externalId,
    botToken: credential.data.botToken,
    botUserId: credential.data.botUserId ?? null,
    missingScopes: missingSlackScopes(
      dataSchema.safeParse(parseJson(row.rawData)).data?.scopes,
    ),
  };
}
