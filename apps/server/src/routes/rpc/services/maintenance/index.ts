import type { ServiceImpl } from "@connectrpc/connect";
import { and, db, desc, eq, inArray, sql } from "@openstatus/db";
import {
  maintenance,
  maintenancesToPageComponents,
  page,
  pageComponent,
} from "@openstatus/db/src/schema";
import type { MaintenanceService } from "@openstatus/proto/maintenance/v1";

import { getRpcContext } from "../../interceptors";
import {
  dbMaintenanceToProto,
  dbMaintenanceToProtoSummary,
} from "./converters";
import {
  invalidDateFormatError,
  invalidDateRangeError,
  maintenanceCreateFailedError,
  maintenanceIdRequiredError,
  maintenanceNotFoundError,
  maintenanceUpdateFailedError,
  pageComponentNotFoundError,
  pageComponentsMixedPagesError,
  pageIdComponentMismatchError,
  pageNotFoundError,
} from "./errors";

// Type that works with both db instance and transaction
type DB = typeof db;
type Transaction = Parameters<Parameters<DB["transaction"]>[0]>[0];

/**
 * Helper to get a maintenance by ID with workspace scope.
 */
async function getMaintenanceById(id: number, workspaceId: number) {
  return db
    .select()
    .from(maintenance)
    .where(
      and(eq(maintenance.id, id), eq(maintenance.workspaceId, workspaceId)),
    )
    .get();
}

/**
 * Helper to get page component IDs for a maintenance.
 */
async function getPageComponentIdsForMaintenance(maintenanceId: number) {
  const components = await db
    .select({ pageComponentId: maintenancesToPageComponents.pageComponentId })
    .from(maintenancesToPageComponents)
    .where(eq(maintenancesToPageComponents.maintenanceId, maintenanceId))
    .all();

  return components.map((c) => String(c.pageComponentId));
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
async function validatePageComponentIds(
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
 * Helper to update page component associations for a maintenance.
 * Accepts an optional transaction to ensure atomicity.
 */
async function updatePageComponentAssociations(
  maintenanceId: number,
  pageComponentIds: number[],
  tx: DB | Transaction = db,
) {
  // Delete existing associations
  await tx
    .delete(maintenancesToPageComponents)
    .where(eq(maintenancesToPageComponents.maintenanceId, maintenanceId));

  // Insert new associations
  if (pageComponentIds.length > 0) {
    await tx.insert(maintenancesToPageComponents).values(
      pageComponentIds.map((pageComponentId) => ({
        maintenanceId,
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
 * Validates that from date is before to date.
 */
function validateDateRange(
  from: Date,
  to: Date,
  fromStr: string,
  toStr: string,
): void {
  if (from >= to) {
    throw invalidDateRangeError(fromStr, toStr);
  }
}

/**
 * Helper to validate page exists in workspace.
 */
async function validatePageExists(
  pageId: number,
  workspaceId: number,
  tx: DB | Transaction = db,
): Promise<void> {
  const pageRecord = await tx
    .select({ id: page.id })
    .from(page)
    .where(and(eq(page.id, pageId), eq(page.workspaceId, workspaceId)))
    .get();

  if (!pageRecord) {
    throw pageNotFoundError(String(pageId));
  }
}

/**
 * Maintenance service implementation for ConnectRPC.
 */
export const maintenanceServiceImpl: ServiceImpl<typeof MaintenanceService> = {
  async createMaintenance(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    const workspaceId = rpcCtx.workspace.id;

    // Parse and validate dates
    const fromDate = parseDate(req.from);
    const toDate = parseDate(req.to);
    validateDateRange(fromDate, toDate, req.from, req.to);

    const providedPageId = Number(req.pageId);

    // Create maintenance and associations in a transaction
    const newMaintenance = await db.transaction(async (tx) => {
      // Validate page exists in workspace
      await validatePageExists(providedPageId, workspaceId, tx);

      // Validate page component IDs
      const validatedComponents = await validatePageComponentIds(
        req.pageComponentIds,
        workspaceId,
        tx,
      );

      // Validate that components belong to the same page as provided pageId
      if (
        validatedComponents.pageId !== null &&
        validatedComponents.pageId !== providedPageId
      ) {
        throw pageIdComponentMismatchError(
          req.pageId,
          String(validatedComponents.pageId),
        );
      }

      // Create the maintenance
      const record = await tx
        .insert(maintenance)
        .values({
          workspaceId,
          pageId: providedPageId,
          title: req.title,
          message: req.message,
          from: fromDate,
          to: toDate,
        })
        .returning()
        .get();

      if (!record) {
        throw maintenanceCreateFailedError();
      }

      // Create page component associations
      await updatePageComponentAssociations(
        record.id,
        validatedComponents.componentIds,
        tx,
      );

      return record;
    });

    // TODO: Implement subscriber notifications when EmailClient.sendMaintenanceNotification is available
    // if (req.notify) { ... }

    return {
      maintenance: dbMaintenanceToProto(newMaintenance, req.pageComponentIds),
    };
  },

  async getMaintenance(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    const workspaceId = rpcCtx.workspace.id;

    if (!req.id || req.id.trim() === "") {
      throw maintenanceIdRequiredError();
    }

    const record = await getMaintenanceById(Number(req.id), workspaceId);
    if (!record) {
      throw maintenanceNotFoundError(req.id);
    }

    const pageComponentIds = await getPageComponentIdsForMaintenance(record.id);

    return {
      maintenance: dbMaintenanceToProto(record, pageComponentIds),
    };
  },

  async listMaintenances(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    const workspaceId = rpcCtx.workspace.id;

    const limit = Math.min(Math.max(req.limit ?? 50, 1), 100);
    const offset = req.offset ?? 0;

    // Build conditions
    const conditions = [eq(maintenance.workspaceId, workspaceId)];

    // Add page_id filter if provided
    if (req.pageId && req.pageId.trim() !== "") {
      conditions.push(eq(maintenance.pageId, Number(req.pageId)));
    }

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(maintenance)
      .where(and(...conditions))
      .get();

    const totalCount = countResult?.count ?? 0;

    // Get maintenances
    const records = await db
      .select()
      .from(maintenance)
      .where(and(...conditions))
      .orderBy(desc(maintenance.from))
      .limit(limit)
      .offset(offset)
      .all();

    // Get page component IDs for each maintenance
    const maintenances = await Promise.all(
      records.map(async (record) => {
        const pageComponentIds = await getPageComponentIdsForMaintenance(
          record.id,
        );
        return dbMaintenanceToProtoSummary(record, pageComponentIds);
      }),
    );

    return {
      maintenances,
      totalSize: totalCount,
    };
  },

  async updateMaintenance(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    const workspaceId = rpcCtx.workspace.id;

    if (!req.id || req.id.trim() === "") {
      throw maintenanceIdRequiredError();
    }

    const record = await getMaintenanceById(Number(req.id), workspaceId);
    if (!record) {
      throw maintenanceNotFoundError(req.id);
    }

    // Parse dates if provided
    const fromDate = req.from ? parseDate(req.from) : null;
    const toDate = req.to ? parseDate(req.to) : null;

    // Validate date range with updated values
    const effectiveFrom = fromDate ?? record.from;
    const effectiveTo = toDate ?? record.to;
    const fromStr = fromDate && req.from ? req.from : record.from.toISOString();
    const toStr = toDate && req.to ? req.to : record.to.toISOString();
    validateDateRange(effectiveFrom, effectiveTo, fromStr, toStr);

    // Update maintenance and associations in a transaction
    const updatedMaintenance = await db.transaction(async (tx) => {
      // Validate page component IDs
      const validatedComponents = await validatePageComponentIds(
        req.pageComponentIds,
        workspaceId,
        tx,
      );

      // Determine effective pageId
      let effectivePageId = record.pageId;
      if (req.pageId && req.pageId.trim() !== "") {
        effectivePageId = Number(req.pageId);
        await validatePageExists(effectivePageId, workspaceId, tx);
      }

      // Validate that components belong to the same page
      if (
        validatedComponents.pageId !== null &&
        effectivePageId !== null &&
        validatedComponents.pageId !== effectivePageId
      ) {
        throw pageIdComponentMismatchError(
          String(effectivePageId),
          String(validatedComponents.pageId),
        );
      }

      // Build update values
      const updateValues: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (req.title !== undefined && req.title !== "") {
        updateValues.title = req.title;
      }

      if (req.message !== undefined && req.message !== "") {
        updateValues.message = req.message;
      }

      if (fromDate) {
        updateValues.from = fromDate;
      }

      if (toDate) {
        updateValues.to = toDate;
      }

      if (req.pageId && req.pageId.trim() !== "") {
        updateValues.pageId = effectivePageId;
      }

      // Update page component associations
      await updatePageComponentAssociations(
        record.id,
        validatedComponents.componentIds,
        tx,
      );

      // Update the maintenance
      const updated = await tx
        .update(maintenance)
        .set(updateValues)
        .where(eq(maintenance.id, record.id))
        .returning()
        .get();

      if (!updated) {
        throw maintenanceUpdateFailedError(req.id);
      }

      return updated;
    });

    // Fetch updated page component IDs
    const pageComponentIds = await getPageComponentIdsForMaintenance(
      updatedMaintenance.id,
    );

    return {
      maintenance: dbMaintenanceToProto(updatedMaintenance, pageComponentIds),
    };
  },

  async deleteMaintenance(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    const workspaceId = rpcCtx.workspace.id;

    if (!req.id || req.id.trim() === "") {
      throw maintenanceIdRequiredError();
    }

    const record = await getMaintenanceById(Number(req.id), workspaceId);
    if (!record) {
      throw maintenanceNotFoundError(req.id);
    }

    // Delete the maintenance (cascade will delete associations)
    await db.delete(maintenance).where(eq(maintenance.id, record.id));

    return { success: true };
  },
};
