import { and, db, eq, inArray } from "@openstatus/db";
import {
  maintenance,
  maintenancesToPageComponents,
  page,
  pageComponent,
} from "@openstatus/db/src/schema";
import {
  addStatusReportUpdate,
  createStatusReport,
  notifyStatusReport,
  resolveStatusReport,
  updateStatusReport,
} from "@openstatus/services/status-report";
import { WebClient } from "@slack/web-api";
import type { Context } from "hono";
import { sendMaintenanceNotification } from "../rpc/services/maintenance";
import { consume, get } from "./confirmation-store";
import type { PendingAction } from "./confirmation-store";
import { toServiceCtx, toSlackMessage } from "./service-adapter";
import { resolveWorkspace } from "./workspace-resolver";

interface SlackInteractionPayload {
  type: string;
  user: { id: string };
  channel: { id: string };
  message: { ts: string };
  team?: { id: string };
  actions: Array<{ action_id: string; value?: string }>;
}

export async function handleSlackInteraction(c: Context) {
  const payload = c.get("slackBody") as SlackInteractionPayload;

  if (payload.type !== "block_actions" || !payload.actions?.length) {
    return c.json({ ok: true });
  }

  const actionId = payload.actions[0].action_id;
  const channelId = payload.channel.id;
  const messageTs = payload.message.ts;
  const userId = payload.user.id;
  const teamId = payload.team?.id;

  let type: "approve" | "approve_notify" | "cancel";
  let pendingId: string;

  if (actionId.startsWith("approve_notify_")) {
    type = "approve_notify";
    pendingId = actionId.replace("approve_notify_", "");
  } else if (actionId.startsWith("approve_")) {
    type = "approve";
    pendingId = actionId.replace("approve_", "");
  } else if (actionId.startsWith("cancel_")) {
    type = "cancel";
    pendingId = actionId.replace("cancel_", "");
  } else {
    return c.json({ ok: true });
  }

  // Non-atomic read for botToken resolution and authorization checks
  const pending = await get(pendingId);

  let botToken: string | undefined = pending?.botToken;
  if (!botToken && teamId) {
    const resolved = await resolveWorkspace(teamId);
    botToken = resolved?.botToken;
  }

  if (!botToken) {
    return c.json({ ok: true });
  }

  const slack = new WebClient(botToken);

  if (!pending) {
    await slack.chat.update({
      channel: channelId,
      ts: messageTs,
      text: ":x: This action has expired. Please try again.",
      blocks: [],
    });
    return c.json({ ok: true });
  }

  if (pending.userId !== userId) {
    await slack.chat.postEphemeral({
      channel: channelId,
      user: userId,
      text: "Only the person who initiated this action can approve or cancel it.",
    });
    return c.json({ ok: true });
  }

  // Atomic consume — prevents double execution from concurrent requests (e.g. double-click).
  // If another request already consumed this action, consume() returns undefined.
  const consumed = await consume(pendingId);
  if (!consumed) {
    return c.json({ ok: true });
  }

  if (type === "cancel") {
    await slack.chat.update({
      channel: channelId,
      ts: messageTs,
      text: ":no_entry_sign: Cancelled.",
      blocks: [],
    });
    return c.json({ ok: true });
  }

  const notify = type === "approve_notify";

  try {
    await executeAction(consumed, notify, slack, channelId, messageTs, {
      slackUserId: userId,
      teamId,
    });
  } catch (err) {
    console.error("[slack] action execution error:", err);
    await slack.chat.update({
      channel: channelId,
      ts: messageTs,
      text: toSlackMessage(err),
      blocks: [],
    });
  }

  return c.json({ ok: true });
}

async function getPageUrl(pageId: number): Promise<string | null> {
  const statusPage = await db
    .select({ slug: page.slug, customDomain: page.customDomain })
    .from(page)
    .where(eq(page.id, pageId))
    .get();

  if (!statusPage) return null;

  return statusPage.customDomain
    ? `https://${statusPage.customDomain}`
    : `https://${statusPage.slug}.openstatus.dev`;
}

async function getReportUrl(pageId: number, reportId: number): Promise<string> {
  const statusPage = await db
    .select({ slug: page.slug, customDomain: page.customDomain })
    .from(page)
    .where(eq(page.id, pageId))
    .get();

  const baseUrl = statusPage?.customDomain
    ? `https://${statusPage.customDomain}`
    : `https://${statusPage?.slug}.openstatus.dev`;
  return `${baseUrl}/events/report/${reportId}`;
}

async function executeAction(
  pending: PendingAction,
  notify: boolean,
  slack: WebClient,
  channelId: string,
  messageTs: string,
  origin: { slackUserId: string; teamId: string | undefined },
) {
  const { action, workspaceId, limits } = pending;

  // Hoisted out of the switch: every service-backed branch below uses
  // the same ctx, and `toServiceCtx` loads the workspace row from the
  // db. Computing it once halves the per-action db traffic. Lazy enough
  // — the `createMaintenance` branch still goes direct to db (migrates
  // in PR 2) and doesn't need ctx, but the extra lookup there is
  // negligible against the maintenance write volume.
  const ctx = await toServiceCtx({
    pending,
    slackUserId: origin.slackUserId,
    teamId: origin.teamId,
  });

  switch (action.type) {
    case "createStatusReport": {
      const { title, status, message, pageId, pageComponentIds } =
        action.params;
      if (pageId == null) {
        throw new Error("pageId is required to create a status report");
      }

      const { statusReport: report, initialUpdate } = await createStatusReport({
        ctx,
        input: {
          title,
          status,
          message,
          date: new Date(),
          pageId,
          pageComponentIds: pageComponentIds?.map((id) => Number(id)) ?? [],
        },
      });

      if (notify) {
        await notifyStatusReport({
          ctx,
          input: { statusReportUpdateId: initialUpdate.id },
        });
      }

      const reportUrl = report.pageId
        ? await getReportUrl(report.pageId, report.id)
        : null;

      await slack.chat.update({
        channel: channelId,
        ts: messageTs,
        text: `:white_check_mark: Status report *${title}* created${notify ? " and subscribers notified" : ""}.${reportUrl ? `\n<${reportUrl}|View on status page>` : ""}`,
        blocks: [],
      });
      break;
    }

    case "addStatusReportUpdate": {
      const { statusReportId, status, message } = action.params;
      const { statusReport: report, statusReportUpdate: update } =
        await addStatusReportUpdate({
          ctx,
          input: { statusReportId, status, message },
        });

      if (notify && report.pageId) {
        await notifyStatusReport({
          ctx,
          input: { statusReportUpdateId: update.id },
        });
      }

      const reportUrl = report.pageId
        ? await getReportUrl(report.pageId, report.id)
        : null;

      await slack.chat.update({
        channel: channelId,
        ts: messageTs,
        text: `:white_check_mark: Update added to *${report.title}* (${status})${notify ? " and subscribers notified" : ""}.\n>${message}${reportUrl ? `\n<${reportUrl}|View on status page>` : ""}`,
        blocks: [],
      });
      break;
    }

    case "updateStatusReport": {
      const { statusReportId, title, pageComponentIds } = action.params;
      const report = await updateStatusReport({
        ctx,
        input: {
          id: statusReportId,
          title: title ?? undefined,
          pageComponentIds: pageComponentIds
            ? pageComponentIds.map((id) => Number(id))
            : undefined,
        },
      });

      await slack.chat.update({
        channel: channelId,
        ts: messageTs,
        text: `:white_check_mark: Status report *${title ?? report.title}* updated.`,
        blocks: [],
      });
      break;
    }

    case "resolveStatusReport": {
      const { statusReportId, message } = action.params;
      const { statusReport: report, statusReportUpdate: update } =
        await resolveStatusReport({
          ctx,
          input: { statusReportId, message },
        });

      if (notify && report.pageId) {
        await notifyStatusReport({
          ctx,
          input: { statusReportUpdateId: update.id },
        });
      }

      const reportUrl = report.pageId
        ? await getReportUrl(report.pageId, report.id)
        : null;

      await slack.chat.update({
        channel: channelId,
        ts: messageTs,
        text: `:white_check_mark: *${report.title}* resolved${notify ? " and subscribers notified" : ""}.${message ? `\n>${message}` : ""}${reportUrl ? `\n<${reportUrl}|View on status page>` : ""}`,
        blocks: [],
      });
      break;
    }

    case "createMaintenance": {
      // Maintenance migrates in PR 2; still writes to db directly here.
      const {
        title,
        message,
        from,
        to,
        pageId: maintenancePageId,
        pageComponentIds: maintenanceComponentIds,
      } = action.params;

      const fromDate = new Date(from);
      const toDate = new Date(to);
      if (fromDate >= toDate) {
        throw new Error("Start time must be before end time");
      }

      const newMaintenance = await db.transaction(async (tx) => {
        const pageRecord = await tx
          .select({ id: page.id })
          .from(page)
          .where(
            and(
              eq(page.id, maintenancePageId),
              eq(page.workspaceId, workspaceId),
            ),
          )
          .get();

        if (!pageRecord) {
          throw new Error("Page not found in this workspace");
        }

        const resolvedPageId = pageRecord.id;

        let componentIds: number[] = [];
        if (maintenanceComponentIds?.length) {
          const numericIds = maintenanceComponentIds.map((id) => Number(id));
          const validComponents = await tx
            .select({ id: pageComponent.id, pageId: pageComponent.pageId })
            .from(pageComponent)
            .where(
              and(
                inArray(pageComponent.id, numericIds),
                eq(pageComponent.workspaceId, workspaceId),
              ),
            )
            .all();

          if (validComponents.length !== numericIds.length) {
            throw new Error("One or more page components not found");
          }

          const componentPageIds = new Set(
            validComponents.map((c) => c.pageId),
          );
          if (componentPageIds.size > 1) {
            throw new Error("All components must belong to the same page");
          }

          const componentPageId = validComponents[0]?.pageId;
          if (componentPageId !== null && componentPageId !== resolvedPageId) {
            throw new Error(
              "Selected components do not belong to the target status page",
            );
          }

          componentIds = numericIds;
        }

        const record = await tx
          .insert(maintenance)
          .values({
            workspaceId,
            pageId: resolvedPageId,
            title,
            message,
            from: fromDate,
            to: toDate,
          })
          .returning()
          .get();

        if (componentIds.length > 0) {
          await tx.insert(maintenancesToPageComponents).values(
            componentIds.map((pageComponentId) => ({
              maintenanceId: record.id,
              pageComponentId,
            })),
          );
        }

        return record;
      });

      if (notify) {
        await sendMaintenanceNotification({
          maintenanceId: newMaintenance.id,
          limits,
        });
      }

      const maintenancePageUrl = newMaintenance.pageId
        ? await getPageUrl(newMaintenance.pageId)
        : null;

      await slack.chat.update({
        channel: channelId,
        ts: messageTs,
        text: `:white_check_mark: Maintenance *${title}* scheduled${notify ? " and subscribers notified" : ""}.${maintenancePageUrl ? `\n<${maintenancePageUrl}|View status page>` : ""}`,
        blocks: [],
      });
      break;
    }
  }
}
