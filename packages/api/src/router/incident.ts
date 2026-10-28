import { resolveChatModel } from "@openstatus/ai";
import { Events } from "@openstatus/analytics";
import { incidentStatus } from "@openstatus/db/src/schema/incidents/constants";
import { sendIncidentCommander } from "@openstatus/emails";
import {
  AddIncidentNoteInput,
  ApprovePostmortemInput,
  BindIncidentSlackChannelInput,
  CloseIncidentInput,
  DeclareIncidentInput,
  DraftPostmortemInput,
  IncidentIdInput,
  LinkIncidentStatusReportInput,
  SetIncidentStatusInput,
  UpdateIncidentInput,
  addIncidentNote,
  approvePostmortem,
  draftPostmortem,
  generatePostmortemDraft,
  getPostmortem,
  afterIncidentClosed,
  afterIncidentDeclared,
  afterIncidentDeleted,
  afterIncidentStatusChanged,
  afterIncidentUpdated,
  afterPostmortemApproved,
  bindIncidentSlackChannel,
  closeIncident,
  declareIncident,
  deleteIncident,
  getIncident,
  getIncidentForStatusReport,
  getIncidentOrThrow,
  linkIncidentStatusReport,
  listIncidentEvents,
  listAllIncidents,
  listIncidents,
  listLinkedStatusReportIds,
  type IncidentEffects,
  incidentEffects,
  resolveDashboardUrl,
  setIncidentStatus,
  unbindIncidentSlackChannel,
  unlinkIncidentStatusReport,
  updateIncident,
} from "@openstatus/services/incident";
import { WebClient } from "@slack/web-api";
import { TRPCError } from "@trpc/server";
import { generateText } from "ai";
import { z } from "zod";

import { createAfterResponse } from "../lib/after-response";
import { chatRateLimit } from "../lib/chat-rate-limit";
import { toServiceCtx, toTRPCError } from "../service-adapter";
import { createTRPCRouter, protectedProcedure } from "../trpc";

const DASHBOARD_URL = resolveDashboardUrl({
  nodeEnv: process.env.NODE_ENV,
  override: process.env.DASHBOARD_URL,
});

type AuthedCtx = Parameters<typeof toServiceCtx>[0];

/** Follow-ups run after the response; the incident is already saved. */
const afterResponse = createAfterResponse("incident follow-up");

function effectsFor(ctx: AuthedCtx): IncidentEffects {
  return incidentEffects({
    clientFor: (token) => new WebClient(token),
    dashboardUrl: DASHBOARD_URL,
    sendCommanderEmail: sendIncidentCommander,
    name: ctx.user.name || ctx.user.email || "A teammate",
  });
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
        const serviceCtx = toServiceCtx(ctx);
        if (input?.limit !== undefined)
          return (await listIncidents({ ctx: serviceCtx, input })).items;
        // no limit = every incident; dashboard calendars and counts need the full history
        return await listAllIncidents({ ctx: serviceCtx, input });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  get: protectedProcedure
    .input(IncidentIdInput)
    .query(async ({ ctx, input }) => {
      try {
        return await getIncidentOrThrow({ ctx: toServiceCtx(ctx), input });
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

  linkedStatusReportIds: protectedProcedure.query(async ({ ctx }) => {
    try {
      return await listLinkedStatusReportIds({ ctx: toServiceCtx(ctx) });
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
    .input(
      DeclareIncidentInput.extend({ openSlackChannel: z.boolean().optional() }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const { openSlackChannel, ...declare } = input;
        const row = await declareIncident({
          ctx: toServiceCtx(ctx),
          input: declare,
        });
        afterResponse(() =>
          afterIncidentDeclared({
            ctx: toServiceCtx(ctx),
            effects: effectsFor(ctx),
            incident: row,
            openSlackChannel: openSlackChannel ?? false,
          }),
        );
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
        if (before) {
          afterResponse(() =>
            afterIncidentUpdated({
              ctx: toServiceCtx(ctx),
              effects: effectsFor(ctx),
              before,
              after: row,
            }),
          );
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
        const row = await setIncidentStatus({ ctx: toServiceCtx(ctx), input });
        afterResponse(() =>
          afterIncidentStatusChanged({
            ctx: toServiceCtx(ctx),
            effects: effectsFor(ctx),
            incidentId: row.id,
            status: row.status,
            note: input.note,
          }),
        );
        return row;
      } catch (err) {
        toTRPCError(err);
      }
    }),

  addNote: protectedProcedure
    .meta({ track: Events.AddManagedIncidentNote })
    // `createdBy` is for trusted callers copying a note in (Slack pins).
    .input(AddIncidentNoteInput.omit({ createdBy: true }))
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

  getPostmortem: protectedProcedure
    .input(IncidentIdInput)
    .query(async ({ ctx, input }) => {
      try {
        return (await getPostmortem({ ctx: toServiceCtx(ctx), input })) ?? null;
      } catch (err) {
        toTRPCError(err);
      }
    }),

  draftPostmortemWithAgent: protectedProcedure
    .meta({ track: Events.DraftManagedPostmortem })
    .input(IncidentIdInput)
    .mutation(async ({ ctx, input }) => {
      const model = resolveChatModel({ plan: ctx.workspace.plan });
      if (!model) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "The agent is not configured on this server",
        });
      }
      // Shares the chat's per-user daily budget: one draft is several calls.
      const limit = await chatRateLimit({ ctx: toServiceCtx(ctx) });
      if (!limit.success) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Rate limit exceeded. Reset at ${new Date(limit.reset).toISOString()}`,
        });
      }
      try {
        return await generatePostmortemDraft({
          ctx: toServiceCtx(ctx),
          incidentId: input.id,
          generate: async ({ system, prompt }) =>
            (await generateText({ model, system, prompt })).text,
          slackFor: (token) => new WebClient(token),
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  draftPostmortem: protectedProcedure
    .meta({ track: Events.DraftManagedPostmortem })
    // An agent draft goes through `draftPostmortemWithAgent`; this is a person typing.
    .input(DraftPostmortemInput.omit({ draftedBy: true }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await draftPostmortem({
          ctx: toServiceCtx(ctx),
          input: { ...input, draftedBy: "user" },
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  approvePostmortem: protectedProcedure
    .meta({ track: Events.ApproveManagedPostmortem })
    .input(ApprovePostmortemInput)
    .mutation(async ({ ctx, input }) => {
      try {
        const before = input.close
          ? await getIncident({ ctx: toServiceCtx(ctx), input })
          : undefined;
        const row = await approvePostmortem({ ctx: toServiceCtx(ctx), input });
        afterResponse(() =>
          afterPostmortemApproved({
            ctx: toServiceCtx(ctx),
            effects: effectsFor(ctx),
            incidentId: input.id,
            closed: !!before && !before.closedAt,
          }),
        );
        return row;
      } catch (err) {
        toTRPCError(err);
      }
    }),

  close: protectedProcedure
    .meta({ track: Events.CloseManagedIncident })
    .input(CloseIncidentInput)
    .mutation(async ({ ctx, input }) => {
      try {
        const row = await closeIncident({ ctx: toServiceCtx(ctx), input });
        afterResponse(() =>
          afterIncidentClosed({
            ctx: toServiceCtx(ctx),
            effects: effectsFor(ctx),
            incidentId: row.id,
          }),
        );
        return row;
      } catch (err) {
        toTRPCError(err);
      }
    }),

  delete: protectedProcedure
    .meta({ track: Events.DeleteManagedIncident })
    .input(IncidentIdInput)
    .mutation(async ({ ctx, input }) => {
      try {
        const before = await getIncident({ ctx: toServiceCtx(ctx), input });
        await deleteIncident({ ctx: toServiceCtx(ctx), input });
        if (before) {
          afterResponse(() =>
            afterIncidentDeleted({
              ctx: toServiceCtx(ctx),
              effects: effectsFor(ctx),
              before,
            }),
          );
        }
      } catch (err) {
        toTRPCError(err);
      }
    }),
});
