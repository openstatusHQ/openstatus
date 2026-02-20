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

// Type that works with both db instance and transaction
type DB = typeof db;
type Transaction = Parameters<Parameters<DB["transaction"]>[0]>[0];
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
  invalidDateFormatError,
  pageComponentNotFoundError,
  pageComponentsMixedPagesError,
  pageIdComponentMismatchError,
  statusReportCreateFailedError,
  statusReportIdRequiredError,
  statusReportNotFoundError,
  statusReportUpdateFailedError,
} from "./errors";

const emailClient = new EmailClient({ apiKey: env.RESEND_API_KEY });

/**
 * Helper to send status report notifications to page subscribers.
 */
export async function sendStatusReportNotification(params: {
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
export async function getStatusReportById(id: number, workspaceId: number) {
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
export async function getPageComponentIdsForReport(statusReportId: number) {
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
 * Result of validating page component IDs.
 */
interface ValidatedPageComponents {
  componentIds: number[];
  pageId: number | null;
}

/**
 * Helper to validate page component IDs belong to the workspace and same page.
 * Accepts an optional transaction to ensure atomicity with subsequent operations.
 */
export async function validatePageComponentIds(
  pageComponentIds: string[],
  workspaceId: number,
  tx: DB | Transaction = db,
): Promise<ValidatedPageComponents> {
  if (pageComponentIds.length === 0) {
    return { componentIds: [], pageId: null };
  }

  const numericIds = pageComponentIds.map((id) => Number(id));

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

  const validComponentsMap = new Map(
    validComponents.map((c) => [c.id, c.pageId]),
  );

  // Check all requested IDs exist
  for (const id of numericIds) {
    if (!validComponentsMap.has(id)) {
      throw pageComponentNotFoundError(String(id));
    }
  }

  // Validate all components belong to the same page
  const pageIds = new Set(validComponents.map((c) => c.pageId));
  if (pageIds.size > 1) {
    throw pageComponentsMixedPagesError();
  }

  const pageId = validComponents[0]?.pageId ?? null;

  return { componentIds: numericIds, pageId };
}

/**
 * Helper to update page component associations for a status report.
 * Accepts an optional transaction to ensure atomicity.
 */
export async function updatePageComponentAssociations(
  statusReportId: number,
  pageComponentIds: number[],
  tx: DB | Transaction = db,
) {
  // Delete existing associations
  await tx
    .delete(statusReportsToPageComponents)
    .where(eq(statusReportsToPageComponents.statusReportId, statusReportId));

  // Insert new associations
  if (pageComponentIds.length > 0) {
    await tx.insert(statusReportsToPageComponents).values(
      pageComponentIds.map((pageComponentId) => ({
        statusReportId,
        pageComponentId,
      })),
    );
  }
}

/**
 * Parses and validates a date string.
 * Throws invalidDateFormatError if the date is invalid.
 */
function parseDate(dateString: string): Date {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    throw invalidDateFormatError(dateString);
  }
  return date;
}

/**
 * Status report service implementation for ConnectRPC.
 */
export const statusReportServiceImpl: ServiceImpl<typeof StatusReportService> =
  {
    async createStatusReport(req, ctx) {
      const rpcCtx = getRpcContext(ctx);
      const workspaceId = rpcCtx.workspace.id;

      // Parse and validate the date before the transaction
      const date = parseDate(req.date);

      // Create status report, associations, and initial update in a transaction
      const { report: newReport, pageId } = await db.transaction(async (tx) => {
        // Validate page component IDs inside transaction to prevent TOCTOU race condition
        const validatedComponents = await validatePageComponentIds(
          req.pageComponentIds,
          workspaceId,
          tx,
        );

        // Validate that provided pageId matches the components' page
        const derivedPageId = validatedComponents.pageId;
        const providedPageId = req.pageId?.trim();
        if (
          derivedPageId !== null &&
          providedPageId &&
          providedPageId !== "" &&
          Number(providedPageId) !== derivedPageId
        ) {
          throw pageIdComponentMismatchError(
            providedPageId,
            String(derivedPageId),
          );
        }

        // Use the derived pageId from components (null if no components)
        const pageId = Number(providedPageId);

        // Create the status report
        const report = await tx
          .insert(statusReport)
          .values({
            workspaceId,
            pageId,
            title: req.title,
            status: protoStatusToDb(req.status),
          })
          .returning()
          .get();

        if (!report) {
          throw statusReportCreateFailedError();
        }

        // Create page component associations
        await updatePageComponentAssociations(
          report.id,
          validatedComponents.componentIds,
          tx,
        );

        // Create the initial update
        const newUpdate = await tx
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
          throw statusReportCreateFailedError();
        }

        return { report, pageId };
      });

      // Send notifications if requested (outside transaction)
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

      // Update report, associations in a transaction
      const updatedReport = await db.transaction(async (tx) => {
        // Validate page component IDs inside transaction to prevent TOCTOU race condition
        // Allows empty array to clear associations; ensures all components belong to same page
        const validatedComponents = await validatePageComponentIds(
          req.pageComponentIds,
          workspaceId,
          tx,
        );

        // Build update values
        const updateValues: Record<string, unknown> = {
          updatedAt: new Date(),
          // Set pageId from validated components (null if no components)
          pageId: validatedComponents.pageId,
        };

        if (req.title !== undefined && req.title !== "") {
          updateValues.title = req.title;
        }

        // Always update page component associations (empty array clears all)
        await updatePageComponentAssociations(
          report.id,
          validatedComponents.componentIds,
          tx,
        );

        // Update the report
        const updated = await tx
          .update(statusReport)
          .set(updateValues)
          .where(eq(statusReport.id, report.id))
          .returning()
          .get();

        if (!updated) {
          throw statusReportUpdateFailedError(req.id);
        }

        return updated;
      });

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

      // Parse and validate the date or use current time
      const date = req.date ? parseDate(req.date) : new Date();

      // Create update and update status report in a transaction
      const updatedReport = await db.transaction(async (tx) => {
        // Create the update
        const newUpdate = await tx
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
        const updated = await tx
          .update(statusReport)
          .set({
            status: protoStatusToDb(req.status),
            updatedAt: new Date(),
          })
          .where(eq(statusReport.id, report.id))
          .returning()
          .get();

        if (!updated) {
          throw statusReportUpdateFailedError(req.statusReportId);
        }

        return updated;
      });

      // Send notifications if requested (outside transaction)
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
