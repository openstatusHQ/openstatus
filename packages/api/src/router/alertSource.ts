import { Events } from "@openstatus/analytics";
import { db, desc, eq, inArray, sql } from "@openstatus/db";
import {
  alertDeadLetter,
  alertInbox,
  alertSource,
} from "@openstatus/db/src/schema";
import {
  listAlertSources,
  setAlertSourceActive,
  updateAlertSourceConfig,
} from "@openstatus/services/alert-source";
import { z } from "zod";

import { toServiceCtx, toTRPCError } from "../service-adapter";
import { createTRPCRouter, protectedProcedure } from "../trpc";

async function sourceIdsFor(workspaceId: number): Promise<number[]> {
  const rows = await db
    .select({ id: alertSource.id })
    .from(alertSource)
    .where(eq(alertSource.workspaceId, workspaceId))
    .all();
  return rows.map((r) => r.id);
}

export const alertSourceRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    try {
      return await listAlertSources({ ctx: toServiceCtx(ctx) });
    } catch (err) {
      toTRPCError(err);
    }
  }),

  /** Counts the ingested payloads we kept but could not process, per outcome. */
  stats: protectedProcedure.query(async ({ ctx }) => {
    const ids = await sourceIdsFor(ctx.workspace.id);
    if (ids.length === 0) {
      return { ignored: 0, invalid: 0, deadLettered: 0, processed: 0 };
    }

    const rows = await db
      .select({ outcome: alertInbox.outcome, count: sql<number>`count(*)` })
      .from(alertInbox)
      .where(inArray(alertInbox.alertSourceId, ids))
      .groupBy(alertInbox.outcome)
      .all();

    const dead = await db
      .select({ count: sql<number>`count(*)` })
      .from(alertDeadLetter)
      .where(inArray(alertDeadLetter.alertSourceId, ids))
      .get();

    const byOutcome = new Map(rows.map((r) => [r.outcome, r.count]));
    return {
      processed: byOutcome.get("processed") ?? 0,
      ignored: byOutcome.get("ignored") ?? 0,
      invalid: byOutcome.get("invalid") ?? 0,
      deadLettered: dead?.count ?? 0,
    };
  }),

  /** The dead-letter list exists to say ingest is broken, not to browse alerts. */
  deadLetters: protectedProcedure
    .input(
      z
        .object({ limit: z.number().int().positive().max(200).default(50) })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const ids = await sourceIdsFor(ctx.workspace.id);
      if (ids.length === 0) return [];
      return db
        .select({
          id: alertDeadLetter.id,
          alertSourceId: alertDeadLetter.alertSourceId,
          fingerprint: alertDeadLetter.fingerprint,
          attempts: alertDeadLetter.attempts,
          finalError: alertDeadLetter.finalError,
          receivedAt: alertDeadLetter.receivedAt,
          diedAt: alertDeadLetter.diedAt,
        })
        .from(alertDeadLetter)
        .where(inArray(alertDeadLetter.alertSourceId, ids))
        .orderBy(desc(alertDeadLetter.diedAt))
        .limit(input?.limit ?? 50)
        .all();
    }),

  updateConfig: protectedProcedure
    .meta({ track: Events.UpdateAlertSource })
    .input(
      z.object({
        id: z.number(),
        stalenessWindowMinutes: z.number().int().positive().optional(),
        signatureSecret: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await updateAlertSourceConfig({
          ctx: toServiceCtx(ctx),
          input,
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  setActive: protectedProcedure
    .meta({ track: Events.UpdateAlertSource })
    .input(z.object({ id: z.number(), active: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await setAlertSourceActive({ ctx: toServiceCtx(ctx), input });
      } catch (err) {
        toTRPCError(err);
      }
    }),
});
