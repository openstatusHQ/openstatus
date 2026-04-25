import { and, eq } from "@openstatus/db";
import {
  integration,
  selectIntegrationSchema,
} from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { type ServiceContext, withTransaction } from "../context";
import { DeleteIntegrationInput } from "./schemas";

/**
 * Best-effort revoke of a Slack bot token before deleting the row.
 *
 * Hard 3s timeout: this runs on Next.js Edge via tRPC, and the router-era
 * call had no timeout, which meant a flapping Slack API could tie up a
 * request for ~15s. A missing or invalid token surfaces as a silent
 * failure on Slack's side — we don't block the delete on the outcome.
 */
async function revokeSlackToken(botToken: string): Promise<void> {
  try {
    await fetch("https://slack.com/api/auth.revoke", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${botToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      signal: AbortSignal.timeout(3_000),
    });
  } catch {
    // Token may already be invalid, or Slack may be unreachable — not our
    // problem once the local row is about to disappear.
  }
}

/**
 * Delete an integration scoped to the caller's workspace. Idempotent —
 * missing rows succeed silently. When the row carries a Slack bot token,
 * attempts to revoke it via `auth.revoke` *after* a successful delete;
 * failure there does not roll the delete back.
 *
 * Order matters: revoking before the transaction would leave a row with
 * an already-invalidated token if the delete then fails. Revoking after
 * the commit means the worst case is a token left valid on Slack's side
 * with no local row referencing it — preferable to broken persisted state.
 *
 * The audit snapshot is taken from the post-delete `RETURNING` row inside
 * the tx so it reflects exactly what was removed.
 */
export async function deleteIntegration(args: {
  ctx: ServiceContext;
  input: DeleteIntegrationInput;
}): Promise<void> {
  const { ctx } = args;
  const input = DeleteIntegrationInput.parse(args.input);

  let revokeBotToken: string | undefined;

  await withTransaction(ctx, async (tx) => {
    const [deleted] = await tx
      .delete(integration)
      .where(
        and(
          eq(integration.id, input.id),
          eq(integration.workspaceId, ctx.workspace.id),
        ),
      )
      .returning();

    if (!deleted) return;

    const credential = deleted.credential as { botToken?: string } | null;
    if (credential?.botToken) revokeBotToken = credential.botToken;

    // Parse through the select schema so the snapshot shape is stable
    // across schema evolution, then strip `credential` — it carries the
    // bot token and any future signing secret, never audit it.
    const parsed = selectIntegrationSchema.parse(deleted);
    const { credential: _credential, ...before } = parsed;
    await emitAudit(tx, ctx, {
      action: "integration.delete",
      entityType: "integration",
      entityId: parsed.id,
      before,
    });
  });

  if (revokeBotToken) {
    await revokeSlackToken(revokeBotToken);
  }
}
