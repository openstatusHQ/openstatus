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
  allowedTransitions,
  approvePostmortem,
  draftPostmortem,
  generatePostmortemDraft,
  getPostmortem,
  announceIncidentChange,
  announceInChannel,
  bindIncidentSlackChannel,
  closeIncident,
  declareIncident,
  deleteIncident,
  displayName,
  escapeMrkdwn,
  getIncident,
  getIncidentForStatusReport,
  isDeletable,
  linkIncidentStatusReport,
  listIncidentEvents,
  listIncidents,
  openIncidentSlackChannel,
  setIncidentStatus,
  unbindIncidentSlackChannel,
  unlinkIncidentStatusReport,
  updateIncident,
} from "@openstatus/services/incident";
import { WebClient } from "@slack/web-api";
import { TRPCError } from "@trpc/server";
import { generateText } from "ai";
import { after } from "next/server.js";
import { z } from "zod";

import { chatRateLimit } from "../lib/chat-rate-limit";
import { toServiceCtx, toTRPCError } from "../service-adapter";
import { createTRPCRouter, protectedProcedure } from "../trpc";

const DASHBOARD_URL =
  process.env.NODE_ENV === "production"
    ? "https://app.openstatus.dev"
    : "http://localhost:3001";

const clientFor = (token: string) => new WebClient(token);

type AuthedCtx = Parameters<typeof toServiceCtx>[0];

/** Slack follow-ups run after the response; the incident is already saved. */
function afterResponse(task: () => Promise<void>) {
  const run = () =>
    task().catch((err) => console.warn("incident slack follow-up failed", err));
  try {
    after(run);
  } catch {
    void run();
  }
}

function announce(
  ctx: AuthedCtx,
  incidentId: number,
  text: string,
  archive = false,
) {
  afterResponse(() =>
    announceIncidentChange({
      ctx: toServiceCtx(ctx),
      incidentId,
      text,
      clientFor,
      dashboardUrl: DASHBOARD_URL,
      archive,
    }),
  );
}

function actorName(ctx: AuthedCtx): string {
  return escapeMrkdwn(ctx.user.name || ctx.user.email || "A teammate");
}

function quote(note: string | undefined): string {
  return note ? `\n>${escapeMrkdwn(note).replaceAll("\n", "\n>")}` : "";
}

/** Best effort: a failed email never fails the mutation that assigned them. */
async function notifyCommander(ctx: AuthedCtx, incidentId: number) {
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
      assignedBy: actorName(ctx),
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
        if (row.commanderId !== null) await notifyCommander(ctx, row.id);
        if (openSlackChannel) {
          afterResponse(async () => {
            await openIncidentSlackChannel({
              ctx: toServiceCtx(ctx),
              incidentId: row.id,
              clientFor,
              dashboardUrl: DASHBOARD_URL,
            });
          });
        }
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
        const commanderChanged = row.commanderId !== before?.commanderId;
        if (row.commanderId !== null && commanderChanged) {
          await notifyCommander(ctx, row.id);
        }
        const changes: string[] = [];
        if (before && row.title !== before.title) {
          changes.push(`title is now *${escapeMrkdwn(row.title)}*`);
        }
        if (before && row.summary !== before.summary) {
          changes.push(
            row.summary ? "summary was updated" : "summary was removed",
          );
        }
        if (before && row.startedAt.getTime() !== before.startedAt.getTime()) {
          const seconds = Math.floor(row.startedAt.getTime() / 1000);
          changes.push(
            `start time is now <!date^${seconds}^{date_short_pretty} {time}|${row.startedAt.toISOString()}>`,
          );
        }
        if (before && row.severity !== before.severity) {
          changes.push(`severity is now *${row.severity}*`);
        }
        if (before && commanderChanged) {
          const after = await getIncident({
            ctx: toServiceCtx(ctx),
            input: { id: row.id },
          });
          changes.push(
            after?.commander
              ? `${escapeMrkdwn(displayName(after.commander))} is now commander`
              : "there is no commander",
          );
        }
        if (changes.length) {
          announce(ctx, row.id, `${actorName(ctx)}: ${changes.join(", ")}.`);
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
        announce(
          ctx,
          row.id,
          `${actorName(ctx)} marked the incident *${row.status}*.${quote(input.note)}`,
          row.status === "canceled",
        );
        return row;
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
    .input(DraftPostmortemInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return await draftPostmortem({ ctx: toServiceCtx(ctx), input });
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
        // Only announce (and archive) when this approval actually closed it.
        if (before && !before.closedAt) {
          announce(
            ctx,
            input.id,
            `${actorName(ctx)} approved the postmortem and closed the incident.`,
            true,
          );
        }
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
        announce(ctx, row.id, `${actorName(ctx)} closed the incident.`, true);
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
        if (before?.slackChannelId) {
          afterResponse(() =>
            announceInChannel({
              ctx: toServiceCtx(ctx),
              incident: before,
              text: `${actorName(ctx)} deleted this incident: it was declared by mistake.`,
              clientFor,
              dashboardUrl: DASHBOARD_URL,
              archive: true,
            }),
          );
        }
      } catch (err) {
        toTRPCError(err);
      }
    }),
});
