// biome-ignore lint/style/useNodejsImportProtocol: some error with build
import crypto from "crypto";
import { z } from "zod";

import { and, eq, sql } from "@openstatus/db";
import { integration } from "@openstatus/db/src/schema";

import { createTRPCRouter, protectedProcedure } from "../trpc";

function signInstallToken(workspaceId: number, ts: number): string {
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret) throw new Error("Slack not configured");
  const payload = JSON.stringify({ workspaceId, ts });
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

function safeJsonParse(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export const integrationRouter = createTRPCRouter({
  list: protectedProcedure.query(async (opts) => {
    const rows = await opts.ctx.db
      .select({
        id: integration.id,
        name: integration.name,
        externalId: integration.externalId,
        rawData: sql<string>`${integration.data}`,
        createdAt: integration.createdAt,
      })
      .from(integration)
      .where(eq(integration.workspaceId, opts.ctx.workspace.id))
      .all();

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      externalId: row.externalId,
      data: safeJsonParse(row.rawData),
      createdAt: row.createdAt,
    }));
  }),

  generateInstallToken: protectedProcedure.mutation(async (opts) => {
    const token = signInstallToken(opts.ctx.workspace.id, Date.now());
    return { token };
  }),

  deleteIntegration: protectedProcedure
    .input(z.object({ integrationId: z.number() }))
    .mutation(async (opts) => {
      const existing = await opts.ctx.db
        .select()
        .from(integration)
        .where(
          and(
            eq(integration.id, opts.input.integrationId),
            eq(integration.workspaceId, opts.ctx.workspace.id),
          ),
        )
        .get();

      if (!existing) return;

      const cred = existing.credential as { botToken?: string } | null;
      if (cred?.botToken) {
        try {
          await fetch("https://slack.com/api/auth.revoke", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${cred.botToken}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
          });
        } catch {
          // Token may already be invalid
        }
      }

      await opts.ctx.db
        .delete(integration)
        .where(eq(integration.id, existing.id));
    }),
});
