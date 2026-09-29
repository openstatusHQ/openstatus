import { Events } from "@openstatus/analytics";
import { incidentStatus } from "@openstatus/db/src/schema/incidents/constants";
import { sendIncidentCommander } from "@openstatus/emails";
import {
  AddIncidentNoteInput,
  BindIncidentSlackChannelInput,
  DeclareIncidentInput,
  IncidentIdInput,
  LinkIncidentStatusReportInput,
  SetIncidentStatusInput,
  UpdateIncidentInput,
  addIncidentNote,
  allowedTransitions,
  bindIncidentSlackChannel,
  closeIncident,
  declareIncident,
  deleteIncident,
  getIncident,
  getIncidentForStatusReport,
  isDeletable,
  linkIncidentStatusReport,
  listIncidentEvents,
  listIncidents,
  setIncidentStatus,
  unbindIncidentSlackChannel,
  unlinkIncidentStatusReport,
  updateIncident,
} from "@openstatus/services/incident";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { toServiceCtx, toTRPCError } from "../service-adapter";
import { createTRPCRouter, protectedProcedure } from "../trpc";

const DASHBOARD_URL =
  process.env.NODE_ENV === "production"
    ? "https://app.openstatus.dev"
    : "http://localhost:3001";

/** Best effort: a failed email never fails the mutation that assigned them. */
async function notifyCommander(
  ctx: Parameters<typeof toServiceCtx>[0],
  incidentId: number,
) {
  try {
    const row = await getIncident({
      ctx: toServiceCtx(ctx),
      input: { id: incidentId },
    });
    const commander = row?.commander;
    if (!row || !commander?.email || commander.id === ctx.user.id) return;
    await sendIncidentCommander({
      to: commander.email,
      incidentTitle: row.title,
      severity: row.severity,
      workspaceName: ctx.workspace.name ?? ctx.workspace.slug,
      assignedBy: ctx.user.name || ctx.user.email || "A teammate",
      url: `${DASHBOARD_URL}/incidents/${row.id}`,
      idempotencyKey: `incident-commander:${row.id}:${commander.id}:${row.updatedAt.getTime()}`,
    });
  } catch (err) {
    console.warn("incident commander email failed", { incidentId, err });
  }
}

export const incidentRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z
        .object({
          status: z.array(z.enum(incidentStatus)).optional(),
          limit: z.number().int().min(1).max(100).optional(),
          offset: z.number().int().min(0).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      try {
        return await listIncidents({ ctx: toServiceCtx(ctx), input });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  get: protectedProcedure
    .input(IncidentIdInput)
    .query(async ({ ctx, input }) => {
      try {
        const row = await getIncident({ ctx: toServiceCtx(ctx), input });
        if (!row) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Incident not found",
          });
        }
        return {
          ...row,
          allowedTransitions: allowedTransitions(row),
          deletable: isDeletable(row),
        };
      } catch (err) {
        toTRPCError(err);
      }
    }),

  forStatusReport: protectedProcedure
    .input(z.object({ statusReportId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      try {
        return (
          (await getIncidentForStatusReport({
            ctx: toServiceCtx(ctx),
            input,
          })) ?? null
        );
      } catch (err) {
        toTRPCError(err);
      }
    }),

  listEvents: protectedProcedure
    .input(IncidentIdInput)
    .query(async ({ ctx, input }) => {
      try {
        return await listIncidentEvents({ ctx: toServiceCtx(ctx), input });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  declare: protectedProcedure
    .meta({ track: Events.DeclareManagedIncident, trackProps: ["severity"] })
    .input(DeclareIncidentInput)
    .mutation(async ({ ctx, input }) => {
      try {
        const row = await declareIncident({ ctx: toServiceCtx(ctx), input });
        if (row.commanderId !== null) await notifyCommander(ctx, row.id);
        return row;
      } catch (err) {
        toTRPCError(err);
      }
    }),

  update: protectedProcedure
    .meta({ track: Events.UpdateManagedIncident })
    .input(UpdateIncidentInput)
    .mutation(async ({ ctx, input }) => {
      try {
        const before = await getIncident({
          ctx: toServiceCtx(ctx),
          input: { id: input.id },
        });
        const row = await updateIncident({ ctx: toServiceCtx(ctx), input });
        if (
          row.commanderId !== null &&
          row.commanderId !== before?.commanderId
        ) {
          await notifyCommander(ctx, row.id);
        }
        return row;
      } catch (err) {
        toTRPCError(err);
      }
    }),

  setStatus: protectedProcedure
    .meta({ track: Events.ChangeManagedIncidentStatus, trackProps: ["status"] })
    .input(SetIncidentStatusInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return await setIncidentStatus({ ctx: toServiceCtx(ctx), input });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  addNote: protectedProcedure
    .meta({ track: Events.AddManagedIncidentNote })
    .input(AddIncidentNoteInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return await addIncidentNote({ ctx: toServiceCtx(ctx), input });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  linkStatusReport: protectedProcedure
    .meta({ track: Events.LinkManagedIncidentReport })
    .input(LinkIncidentStatusReportInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return await linkIncidentStatusReport({
          ctx: toServiceCtx(ctx),
          input,
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  unlinkStatusReport: protectedProcedure
    .input(IncidentIdInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return await unlinkIncidentStatusReport({
          ctx: toServiceCtx(ctx),
          input,
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  bindSlackChannel: protectedProcedure
    .input(BindIncidentSlackChannelInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return await bindIncidentSlackChannel({
          ctx: toServiceCtx(ctx),
          input,
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  unbindSlackChannel: protectedProcedure
    .input(IncidentIdInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return await unbindIncidentSlackChannel({
          ctx: toServiceCtx(ctx),
          input,
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  close: protectedProcedure
    .meta({ track: Events.CloseManagedIncident })
    .input(IncidentIdInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return await closeIncident({ ctx: toServiceCtx(ctx), input });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  delete: protectedProcedure
    .meta({ track: Events.DeleteManagedIncident })
    .input(IncidentIdInput)
    .mutation(async ({ ctx, input }) => {
      try {
        await deleteIncident({ ctx: toServiceCtx(ctx), input });
      } catch (err) {
        toTRPCError(err);
      }
    }),
});
