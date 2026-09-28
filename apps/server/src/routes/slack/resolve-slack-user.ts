import { getLogger } from "@logtape/logtape";
import type { Workspace } from "@openstatus/db/src/schema/workspaces/validation";
import type { ServiceContext } from "@openstatus/services";
import { findMemberIdByEmail } from "@openstatus/services/member";
import type { WebClient } from "@slack/web-api";

const logger = getLogger(["api-server", "slack", "resolve-user"]);

// Per process, like the event dedup in handler.ts. Nothing is persisted: the
// audit row and the `*_by` columns record the resolved id where it mattered.
// Misses expire sooner so a freshly invited member is picked up quickly.
const HIT_TTL_MS = 60 * 60_000;
const MISS_TTL_MS = 10 * 60_000;
const cache = new Map<string, { userId: number | null; expiresAt: number }>();

export function resetSlackUserCache() {
  cache.clear();
}

function readCache(key: string): number | null | undefined {
  const now = Date.now();
  for (const [k, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(k);
  }
  return cache.get(key)?.userId;
}

/**
 * openstatus member behind a Slack user, matched by verified profile email.
 * Attribution only, so every failure (missing `users:read.email` scope, no
 * email, no unique member) is `null`.
 */
export async function resolveSlackUserId(args: {
  workspace: Workspace;
  teamId: string;
  slackUserId: string;
  slack: WebClient;
}): Promise<number | null> {
  const { workspace, teamId, slackUserId, slack } = args;
  if (!teamId || !slackUserId) return null;

  const key = `${workspace.id}:${teamId}:${slackUserId}`;
  const hit = readCache(key);
  if (hit !== undefined) return hit;

  let userId: number | null = null;
  try {
    const info = await slack.users.info({ user: slackUserId });
    const email = info.user?.profile?.email;
    if (email) {
      const ctx: ServiceContext = {
        workspace,
        actor: { type: "system", job: "slack-user-automap" },
      };
      userId = await findMemberIdByEmail({ ctx, input: { email } });
    }
    // Only a completed lookup is cached; a thrown call may be transient.
    cache.set(key, {
      userId,
      expiresAt: Date.now() + (userId === null ? MISS_TTL_MS : HIT_TTL_MS),
    });
  } catch (err) {
    // `missing_scope` until the workspace reinstalls with users:read.email.
    logger.warn("slack user resolution failed", {
      workspaceId: workspace.id,
      teamId,
      error: (err as { data?: { error?: string } })?.data?.error ?? String(err),
    });
  }
  return userId;
}
