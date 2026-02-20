import { env } from "@/env";
import { db, eq } from "@openstatus/db";
import {
  page,
  statusReport,
  statusReportUpdate,
} from "@openstatus/db/src/schema";
import { WebClient } from "@slack/web-api";
import type { Context } from "hono";
import {
  getStatusReportById,
  sendStatusReportNotification,
  updatePageComponentAssociations,
  validatePageComponentIds,
} from "../rpc/services/status-report";
import { retrieve } from "./confirmation-store";
import type { PendingAction } from "./confirmation-store";

interface SlackInteractionPayload {
  type: string;
  user: { id: string };
  channel: { id: string };
  message: { ts: string };
  actions: Array<{ action_id: string; value?: string }>;
}

function getSlackClient(): WebClient {
  return new WebClient(env.SLACK_BOT_TOKEN);
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

  const slack = getSlackClient();
  const pending = retrieve(pendingId);

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
    await executeAction(pending, notify, slack, channelId, messageTs);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    await slack.chat.update({
      channel: channelId,
      ts: messageTs,
      text: `:x: Failed: ${errMsg}`,
      blocks: [],
    });
  }

  return c.json({ ok: true });
}

async function executeAction(
  pending: PendingAction,
  notify: boolean,
  slack: WebClient,
  channelId: string,
  messageTs: string,
) {
  const { action, workspaceId, limits } = pending;

  switch (action.type) {
    case "createStatusReport": {
      const { title, status, message, pageId, pageComponentIds } =
        action.params;

      const result = await db.transaction(async (tx) => {
        const validated = pageComponentIds?.length
          ? await validatePageComponentIds(pageComponentIds, workspaceId, tx)
          : { componentIds: [], pageId: null };

        const report = await tx
          .insert(statusReport)
          .values({
            workspaceId,
            pageId,
            title,
            status,
          })
          .returning()
          .get();

        if (validated.componentIds.length > 0) {
          await updatePageComponentAssociations(
            report.id,
            validated.componentIds,
            tx,
          );
        }

        await tx
          .insert(statusReportUpdate)
          .values({
            statusReportId: report.id,
            status,
            date: new Date(),
            message,
          })
          .returning()
          .get();

        return report;
      });

      if (notify) {
        await sendStatusReportNotification({
          statusReportId: result.id,
          pageId,
          reportTitle: title,
          status,
          message,
          date: new Date(),
          limits,
        });
      }

      const statusPage = await db
        .select({ slug: page.slug, customDomain: page.customDomain })
        .from(page)
        .where(eq(page.id, pageId))
        .get();

      const baseUrl = statusPage?.customDomain
        ? `https://${statusPage.customDomain}`
        : `https://${statusPage?.slug}.openstatus.dev`;
      const reportUrl = `${baseUrl}/events/report/${result.id}`;

      await slack.chat.update({
        channel: channelId,
        ts: messageTs,
        text: `:white_check_mark: Status report *${title}* created${notify ? " and subscribers notified" : ""}.\n<${reportUrl}|View on status page>`,
        blocks: [],
      });
      break;
    }

    case "addStatusReportUpdate": {
      const { statusReportId, status, message } = action.params;

      const report = await getStatusReportById(statusReportId, workspaceId);
      if (!report) {
        throw new Error("Status report not found");
      }

      await db.transaction(async (tx) => {
        await tx
          .insert(statusReportUpdate)
          .values({
            statusReportId: report.id,
            status,
            date: new Date(),
            message,
          })
          .returning()
          .get();

        await tx
          .update(statusReport)
          .set({ status, updatedAt: new Date() })
          .where(eq(statusReport.id, report.id));
      });

      if (notify && report.pageId) {
        await sendStatusReportNotification({
          statusReportId: report.id,
          pageId: report.pageId,
          reportTitle: report.title,
          status,
          message,
          date: new Date(),
          limits,
        });
      }

      await slack.chat.update({
        channel: channelId,
        ts: messageTs,
        text: `:white_check_mark: Update added to *${report.title}* (${status})${notify ? " and subscribers notified" : ""}.`,
        blocks: [],
      });
      break;
    }

    case "updateStatusReport": {
      const { statusReportId, title, pageComponentIds } = action.params;

      const report = await getStatusReportById(statusReportId, workspaceId);
      if (!report) {
        throw new Error("Status report not found");
      }

      await db.transaction(async (tx) => {
        if (pageComponentIds) {
          const validated = await validatePageComponentIds(
            pageComponentIds,
            workspaceId,
            tx,
          );
          await updatePageComponentAssociations(
            report.id,
            validated.componentIds,
            tx,
          );
        }

        const updateValues: Record<string, unknown> = {
          updatedAt: new Date(),
        };
        if (title) updateValues.title = title;

        await tx
          .update(statusReport)
          .set(updateValues)
          .where(eq(statusReport.id, report.id));
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

      const report = await getStatusReportById(statusReportId, workspaceId);
      if (!report) {
        throw new Error("Status report not found");
      }

      await db.transaction(async (tx) => {
        await tx
          .insert(statusReportUpdate)
          .values({
            statusReportId: report.id,
            status: "resolved",
            date: new Date(),
            message,
          })
          .returning()
          .get();

        await tx
          .update(statusReport)
          .set({ status: "resolved", updatedAt: new Date() })
          .where(eq(statusReport.id, report.id));
      });

      if (notify && report.pageId) {
        await sendStatusReportNotification({
          statusReportId: report.id,
          pageId: report.pageId,
          reportTitle: report.title,
          status: "resolved",
          message,
          date: new Date(),
          limits,
        });
      }

      await slack.chat.update({
        channel: channelId,
        ts: messageTs,
        text: `:white_check_mark: *${report.title}* resolved${notify ? " and subscribers notified" : ""}.`,
        blocks: [],
      });
      break;
    }
  }
}
