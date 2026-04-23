import { getLogger } from "@logtape/logtape";
import { and, db, eq, inArray } from "@openstatus/db";
import {
  maintenance,
  maintenancesToPageComponents,
  page,
  pageComponent,
  statusReport,
  statusReportUpdate,
} from "@openstatus/db/src/schema";
import type { ActionEvent, Adapter } from "chat";
import { sendMaintenanceNotification } from "../rpc/services/maintenance";
import {
  getStatusReportById,
  sendStatusReportNotification,
  updatePageComponentAssociations,
  validatePageComponentIds,
} from "../rpc/services/status-report";
import { bot } from "./bot";
import { consume, get } from "./confirmation-store";
import type { PendingAction } from "./confirmation-store";

const logger = getLogger("api-server");

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

async function editMessage(adapter: Adapter, threadId: string, messageId: string, text: string) {
  await adapter.editMessage(threadId, messageId, text);
}

async function handleApproval(event: ActionEvent, notify: boolean) {
  const actionId = event.value;
  if (!actionId) return;

  const pending = await get(actionId);
  if (!pending) {
    await editMessage(
      event.adapter,
      event.threadId,
      event.messageId,
      ":x: This action has expired. Please try again.",
    );
    return;
  }

  if (pending.userId !== event.user.userId) {
    if (event.thread) {
      await event.thread.postEphemeral(
        event.user,
        "Only the person who initiated this action can approve or cancel it.",
        { fallbackToDM: false },
      );
    }
    return;
  }

  const consumed = await consume(actionId);
  if (!consumed) return;

  try {
    const text = await executeAction(consumed, notify);
    await editMessage(event.adapter, event.threadId, event.messageId, text);
  } catch (err) {
    logger.error("slack action execution error", { error: err });
    await editMessage(
      event.adapter,
      event.threadId,
      event.messageId,
      ":x: Something went wrong. Please try again.",
    );
  }
}

async function executeAction(pending: PendingAction, notify: boolean): Promise<string> {
  const { action, workspaceId, limits } = pending;

  switch (action.type) {
    case "createStatusReport": {
      const { title, status, message, pageId, pageComponentIds } = action.params;

      const result = await db.transaction(async (tx) => {
        const validated = pageComponentIds?.length
          ? await validatePageComponentIds(pageComponentIds, workspaceId, tx)
          : { componentIds: [], pageId: null };

        if (validated.pageId !== null && pageId != null && pageId !== validated.pageId) {
          throw new Error(
            `pageId ${pageId} does not match the page (${validated.pageId}) that the selected components belong to`,
          );
        }

        const resolvedPageId = validated.pageId ?? pageId;

        const report = await tx
          .insert(statusReport)
          .values({ workspaceId, pageId: resolvedPageId, title, status })
          .returning()
          .get();

        if (validated.componentIds.length > 0) {
          await updatePageComponentAssociations(report.id, validated.componentIds, tx);
        }

        const newUpdate = await tx
          .insert(statusReportUpdate)
          .values({
            statusReportId: report.id,
            status,
            date: new Date(),
            message,
          })
          .returning()
          .get();

        return { report, updateId: newUpdate.id };
      });

      if (!result || !result.report.pageId) {
        throw new Error("Failed to create status report");
      }

      if (notify) {
        await sendStatusReportNotification({
          statusReportUpdateId: result.updateId,
          limits,
        });
      }

      const reportUrl = await getReportUrl(result.report.pageId, result.report.id);

      return `:white_check_mark: Status report *${title}* created${notify ? " and subscribers notified" : ""}.\n<${reportUrl}|View on status page>`;
    }

    case "addStatusReportUpdate": {
      const { statusReportId, status, message } = action.params;

      const report = await getStatusReportById(statusReportId, workspaceId);
      if (!report) throw new Error("Status report not found");

      const updateId = await db.transaction(async (tx) => {
        const newUpdate = await tx
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

        return newUpdate.id;
      });

      if (notify && report.pageId) {
        await sendStatusReportNotification({
          statusReportUpdateId: updateId,
          limits,
        });
      }

      const updateReportUrl = report.pageId ? await getReportUrl(report.pageId, report.id) : null;

      return `:white_check_mark: Update added to *${report.title}* (${status})${notify ? " and subscribers notified" : ""}.\n>${message}${updateReportUrl ? `\n<${updateReportUrl}|View on status page>` : ""}`;
    }

    case "updateStatusReport": {
      const { statusReportId, title, pageComponentIds } = action.params;

      const report = await getStatusReportById(statusReportId, workspaceId);
      if (!report) throw new Error("Status report not found");

      await db.transaction(async (tx) => {
        if (pageComponentIds) {
          const validated = await validatePageComponentIds(pageComponentIds, workspaceId, tx);
          await updatePageComponentAssociations(report.id, validated.componentIds, tx);
        }

        const updateValues: Record<string, unknown> = {
          updatedAt: new Date(),
        };
        if (title) updateValues.title = title;

        await tx.update(statusReport).set(updateValues).where(eq(statusReport.id, report.id));
      });

      return `:white_check_mark: Status report *${title ?? report.title}* updated.`;
    }

    case "resolveStatusReport": {
      const { statusReportId, message } = action.params;

      const report = await getStatusReportById(statusReportId, workspaceId);
      if (!report) throw new Error("Status report not found");

      const resolveUpdateId = await db.transaction(async (tx) => {
        const newUpdate = await tx
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

        return newUpdate.id;
      });

      if (notify && report.pageId) {
        await sendStatusReportNotification({
          statusReportUpdateId: resolveUpdateId,
          limits,
        });
      }

      const resolveReportUrl = report.pageId ? await getReportUrl(report.pageId, report.id) : null;

      return `:white_check_mark: *${report.title}* resolved${notify ? " and subscribers notified" : ""}.${message ? `\n>${message}` : ""}${resolveReportUrl ? `\n<${resolveReportUrl}|View on status page>` : ""}`;
    }

    case "createMaintenance": {
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
          .where(and(eq(page.id, maintenancePageId), eq(page.workspaceId, workspaceId)))
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

          const componentPageIds = new Set(validComponents.map((c) => c.pageId));
          if (componentPageIds.size > 1) {
            throw new Error("All components must belong to the same page");
          }

          const componentPageId = validComponents[0]?.pageId;
          if (componentPageId !== null && componentPageId !== resolvedPageId) {
            throw new Error("Selected components do not belong to the target status page");
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

      return `:white_check_mark: Maintenance *${title}* scheduled${notify ? " and subscribers notified" : ""}.${maintenancePageUrl ? `\n<${maintenancePageUrl}|View status page>` : ""}`;
    }
  }
}

export function registerActionHandlers() {
  bot.onAction("approve", (event) => handleApproval(event, false));
  bot.onAction("approve_notify", (event) => handleApproval(event, true));
  bot.onAction("cancel", async (event) => {
    const actionId = event.value;
    if (!actionId) return;
    const consumed = await consume(actionId);
    if (!consumed) return;
    await editMessage(event.adapter, event.threadId, event.messageId, ":no_entry_sign: Cancelled.");
  });
}
