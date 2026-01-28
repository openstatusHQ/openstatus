import type { ServiceImpl } from "@connectrpc/connect";
import {
  and,
  db,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  sql,
} from "@openstatus/db";
import {
  page,
  pageComponent,
  pageSubscriber,
  statusReport,
  statusReportUpdate,
  statusReportsToPageComponents,
} from "@openstatus/db/src/schema";
import type { Limits } from "@openstatus/db/src/schema/plan/schema";
import { EmailClient } from "@openstatus/emails";
import type { StatusReportService } from "@openstatus/proto/status_report/v1";
import { StatusReportStatus } from "@openstatus/proto/status_report/v1";

import { env } from "@/env";
import { getRpcContext } from "../../interceptors";
import {
  dbReportToProto,
  dbReportToProtoSummary,
  protoStatusToDb,
} from "./converters";
import {
  pageComponentNotFoundError,
  statusReportCreateFailedError,
  statusReportIdRequiredError,
  statusReportNotFoundError,
  statusReportUpdateFailedError,
} from "./errors";

const emailClient = new EmailClient({ apiKey: env.RESEND_API_KEY });

/**
 * Helper to send status report notifications to page subscribers.
 */
async function sendStatusReportNotification(params: {
  statusReportId: number;
  pageId: number;
  reportTitle: string;
  status: "investigating" | "identified" | "monitoring" | "resolved";
  message: string;
  date: Date;
  limits: Limits;
}) {
  const { statusReportId, pageId, reportTitle, status, message, date, limits } =
    params;

  // Check if workspace has status-subscribers feature enabled
  if (!limits["status-subscribers"]) {
    return;
  }

  // Get page info
  const pageInfo = await db.query.page.findFirst({
    where: eq(page.id, pageId),
  });

  if (!pageInfo) {
    return;
  }

  // Get verified subscribers who haven't unsubscribed
  const subscribers = await db
    .select()
    .from(pageSubscriber)
    .where(
      and(
        eq(pageSubscriber.pageId, pageId),
        isNotNull(pageSubscriber.acceptedAt),
        isNull(pageSubscriber.unsubscribedAt),
      ),
    )
    .all();

  const validSubscribers = subscribers.filter(
    (s): s is typeof s & { token: string } =>
      s.token !== null && s.acceptedAt !== null && s.unsubscribedAt === null,
  );

  if (validSubscribers.length === 0) {
    return;
  }

  // Get page components for this status report
  const statusReportWithComponents = await db.query.statusReport.findFirst({
    where: eq(statusReport.id, statusReportId),
    with: {
      statusReportsToPageComponents: {
        with: { pageComponent: true },
      },
    },
  });

  const pageComponents =
    statusReportWithComponents?.statusReportsToPageComponents.map(
      (i) => i.pageComponent.name,
    ) ?? [];

  // Send notification emails
  await emailClient.sendStatusReportUpdate({
    subscribers: validSubscribers.map((subscriber) => ({
      email: subscriber.email,
      token: subscriber.token,
    })),
    pageTitle: pageInfo.title,
    pageSlug: pageInfo.slug,
    customDomain: pageInfo.customDomain,
    reportTitle,
    status,
    message,
    date: date.toISOString(),
    pageComponents,
  });
}

/**
 * Helper to get a status report by ID with workspace scope.
 */
async function getStatusReportById(id: number, workspaceId: number) {
  return db
    .select()
    .from(statusReport)
    .where(
      and(eq(statusReport.id, id), eq(statusReport.workspaceId, workspaceId)),
    )
    .get();
}

/**
 * Helper to get page component IDs for a status report.
 */
async function getPageComponentIdsForReport(statusReportId: number) {
  const components = await db
    .select({ pageComponentId: statusReportsToPageComponents.pageComponentId })
    .from(statusReportsToPageComponents)
    .where(eq(statusReportsToPageComponents.statusReportId, statusReportId))
    .all();

  return components.map((c) => String(c.pageComponentId));
}

/**
 * Helper to get updates for a status report, ordered by date descending.
 */
async function getUpdatesForReport(statusReportId: number) {
  return db
    .select()
    .from(statusReportUpdate)
    .where(eq(statusReportUpdate.statusReportId, statusReportId))
    .orderBy(desc(statusReportUpdate.date))
    .all();
}

/**
 * Helper to validate page component IDs belong to the workspace.
 */
async function validatePageComponentIds(
  pageComponentIds: string[],
  workspaceId: number,
): Promise<number[]> {
  if (pageComponentIds.length === 0) {
    return [];
  }

  const numericIds = pageComponentIds.map((id) => Number(id));

  const validComponents = await db
    .select({ id: pageComponent.id })
    .from(pageComponent)
    .where(
      and(
        inArray(pageComponent.id, numericIds),
        eq(pageComponent.workspaceId, workspaceId),
      ),
    )
    .all();

  const validIds = new Set(validComponents.map((c) => c.id));

  for (const id of numericIds) {
    if (!validIds.has(id)) {
      throw pageComponentNotFoundError(String(id));
    }
  }

  return numericIds;
}

/**
 * Helper to update page component associations for a status report.
 */
async function updatePageComponentAssociations(
  statusReportId: number,
  pageComponentIds: number[],
) {
  // Delete existing associations
  await db
    .delete(statusReportsToPageComponents)
    .where(eq(statusReportsToPageComponents.statusReportId, statusReportId));

  // Insert new associations
  if (pageComponentIds.length > 0) {
    await db.insert(statusReportsToPageComponents).values(
      pageComponentIds.map((pageComponentId) => ({
        statusReportId,
        pageComponentId,
      })),
    );
  }
}

/**
 * Status report service implementation for ConnectRPC.
 */
export const statusReportServiceImpl: ServiceImpl<typeof StatusReportService> =
  {
    async createStatusReport(req, ctx) {
      const rpcCtx = getRpcContext(ctx);
      const workspaceId = rpcCtx.workspace.id;

      // Validate page component IDs if provided
      const validPageComponentIds = await validatePageComponentIds(
        req.pageComponentIds,
        workspaceId,
      );

      // Parse the date
      const date = new Date(req.date);

      // Use pageId from request
      const pageId = Number(req.pageId);

      // Create the status report
      const newReport = await db
        .insert(statusReport)
        .values({
          workspaceId,
          pageId,
          title: req.title,
          status: protoStatusToDb(req.status),
        })
        .returning()
        .get();

      if (!newReport) {
        throw statusReportCreateFailedError();
      }

      // Create page component associations
      await updatePageComponentAssociations(
        newReport.id,
        validPageComponentIds,
      );

      // Create the initial update
      const newUpdate = await db
        .insert(statusReportUpdate)
        .values({
          statusReportId: newReport.id,
          status: protoStatusToDb(req.status),
          date,
          message: req.message,
        })
        .returning()
        .get();

      if (!newUpdate) {
        throw statusReportCreateFailedError();
      }

      // Send notifications if requested
      if (req.notify) {
        await sendStatusReportNotification({
          statusReportId: newReport.id,
          pageId,
          reportTitle: newReport.title,
          status: protoStatusToDb(req.status),
          message: req.message,
          date,
          limits: rpcCtx.workspace.limits,
        });
      }

      // Fetch the updates for the response
      const updates = await getUpdatesForReport(newReport.id);

      return {
        statusReport: dbReportToProto(newReport, req.pageComponentIds, updates),
      };
    },

    async getStatusReport(req, ctx) {
      const rpcCtx = getRpcContext(ctx);
      const workspaceId = rpcCtx.workspace.id;

      if (!req.id || req.id.trim() === "") {
        throw statusReportIdRequiredError();
      }

      const report = await getStatusReportById(Number(req.id), workspaceId);
      if (!report) {
        throw statusReportNotFoundError(req.id);
      }

      const pageComponentIds = await getPageComponentIdsForReport(report.id);
      const updates = await getUpdatesForReport(report.id);

      return {
        statusReport: dbReportToProto(report, pageComponentIds, updates),
      };
    },

    async listStatusReports(req, ctx) {
      const rpcCtx = getRpcContext(ctx);
      const workspaceId = rpcCtx.workspace.id;

      const limit = Math.min(Math.max(req.limit ?? 50, 1), 100);
      const offset = req.offset ?? 0;

      // Build conditions
      const conditions = [eq(statusReport.workspaceId, workspaceId)];

      // Add status filter if provided
      if (req.statuses.length > 0) {
        const dbStatuses = req.statuses
          .filter((s) => s !== StatusReportStatus.UNSPECIFIED)
          .map(protoStatusToDb);
        if (dbStatuses.length > 0) {
          conditions.push(inArray(statusReport.status, dbStatuses));
        }
      }

      // Get total count
      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(statusReport)
        .where(and(...conditions))
        .get();

      const totalCount = countResult?.count ?? 0;

      // Get status reports
      const reports = await db
        .select()
        .from(statusReport)
        .where(and(...conditions))
        .orderBy(desc(statusReport.createdAt))
        .limit(limit)
        .offset(offset)
        .all();

      // Get page component IDs for each report
      const statusReports = await Promise.all(
        reports.map(async (report) => {
          const pageComponentIds = await getPageComponentIdsForReport(
            report.id,
          );
          return dbReportToProtoSummary(report, pageComponentIds);
        }),
      );

      return {
        statusReports,
        totalSize: totalCount,
      };
    },

    async updateStatusReport(req, ctx) {
      const rpcCtx = getRpcContext(ctx);
      const workspaceId = rpcCtx.workspace.id;

      if (!req.id || req.id.trim() === "") {
        throw statusReportIdRequiredError();
      }

      const report = await getStatusReportById(Number(req.id), workspaceId);
      if (!report) {
        throw statusReportNotFoundError(req.id);
      }

      // Build update values
      const updateValues: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (req.title !== undefined && req.title !== "") {
        updateValues.title = req.title;
      }

      // Update page component associations if provided
      if (req.pageComponentIds.length > 0) {
        const validPageComponentIds = await validatePageComponentIds(
          req.pageComponentIds,
          workspaceId,
        );
        await updatePageComponentAssociations(report.id, validPageComponentIds);

        // Update pageId based on first component
        if (validPageComponentIds.length > 0) {
          const firstComponent = await db
            .select({ pageId: pageComponent.pageId })
            .from(pageComponent)
            .where(eq(pageComponent.id, validPageComponentIds[0]))
            .get();
          updateValues.pageId = firstComponent?.pageId ?? null;
        }
      }

      // Update the report
      const updatedReport = await db
        .update(statusReport)
        .set(updateValues)
        .where(eq(statusReport.id, report.id))
        .returning()
        .get();

      if (!updatedReport) {
        throw statusReportUpdateFailedError(req.id);
      }

      // Fetch updated data
      const pageComponentIds = await getPageComponentIdsForReport(
        updatedReport.id,
      );
      const updates = await getUpdatesForReport(updatedReport.id);

      return {
        statusReport: dbReportToProto(updatedReport, pageComponentIds, updates),
      };
    },

    async deleteStatusReport(req, ctx) {
      const rpcCtx = getRpcContext(ctx);
      const workspaceId = rpcCtx.workspace.id;

      if (!req.id || req.id.trim() === "") {
        throw statusReportIdRequiredError();
      }

      const report = await getStatusReportById(Number(req.id), workspaceId);
      if (!report) {
        throw statusReportNotFoundError(req.id);
      }

      // Delete the status report (cascade will delete updates and associations)
      await db.delete(statusReport).where(eq(statusReport.id, report.id));

      return { success: true };
    },

    async addStatusReportUpdate(req, ctx) {
      const rpcCtx = getRpcContext(ctx);
      const workspaceId = rpcCtx.workspace.id;

      if (!req.statusReportId || req.statusReportId.trim() === "") {
        throw statusReportIdRequiredError();
      }

      const report = await getStatusReportById(
        Number(req.statusReportId),
        workspaceId,
      );
      if (!report) {
        throw statusReportNotFoundError(req.statusReportId);
      }

      // Parse the date or use current time
      const date = req.date ? new Date(req.date) : new Date();

      // Create the update
      const newUpdate = await db
        .insert(statusReportUpdate)
        .values({
          statusReportId: report.id,
          status: protoStatusToDb(req.status),
          date,
          message: req.message,
        })
        .returning()
        .get();

      if (!newUpdate) {
        throw statusReportUpdateFailedError(req.statusReportId);
      }

      // Update the status report's status and updatedAt
      const updatedReport = await db
        .update(statusReport)
        .set({
          status: protoStatusToDb(req.status),
          updatedAt: new Date(),
        })
        .where(eq(statusReport.id, report.id))
        .returning()
        .get();

      if (!updatedReport) {
        throw statusReportUpdateFailedError(req.statusReportId);
      }

      // Send notifications if requested
      if (req.notify && updatedReport.pageId) {
        await sendStatusReportNotification({
          statusReportId: updatedReport.id,
          pageId: updatedReport.pageId,
          reportTitle: updatedReport.title,
          status: protoStatusToDb(req.status),
          message: req.message,
          date,
          limits: rpcCtx.workspace.limits,
        });
      }

      // Fetch all updates
      const pageComponentIds = await getPageComponentIdsForReport(
        updatedReport.id,
      );
      const updates = await getUpdatesForReport(updatedReport.id);

      return {
        statusReport: dbReportToProto(updatedReport, pageComponentIds, updates),
      };
    },
  };
