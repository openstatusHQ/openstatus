import type { ServiceImpl } from "@connectrpc/connect";
import { and, db, desc, eq, inArray, isNull, sql } from "@openstatus/db";
import {
  monitor,
  page,
  pageComponent,
  pageComponentGroup,
  pageSubscriber,
  statusReport,
  statusReportUpdate,
  statusReportsToPageComponents,
} from "@openstatus/db/src/schema";
import type { StatusPageService } from "@openstatus/proto/status_page/v1";
import { OverallStatus } from "@openstatus/proto/status_page/v1";
import { nanoid } from "nanoid";

import { getRpcContext } from "../../interceptors";
import {
  dbComponentToProto,
  dbGroupToProto,
  dbPageToProto,
  dbPageToProtoSummary,
  dbSubscriberToProto,
} from "./converters";
import {
  componentGroupCreateFailedError,
  componentGroupNotFoundError,
  componentGroupUpdateFailedError,
  identifierRequiredError,
  monitorNotFoundError,
  pageComponentCreateFailedError,
  pageComponentNotFoundError,
  pageComponentUpdateFailedError,
  slugAlreadyExistsError,
  statusPageCreateFailedError,
  statusPageIdRequiredError,
  statusPageNotFoundError,
  statusPageUpdateFailedError,
  subscriberCreateFailedError,
  subscriberNotFoundError,
} from "./errors";

/**
 * Helper to get a status page by ID with workspace scope.
 */
async function getPageById(id: number, workspaceId: number) {
  return db
    .select()
    .from(page)
    .where(and(eq(page.id, id), eq(page.workspaceId, workspaceId)))
    .get();
}

/**
 * Helper to get a status page by slug.
 */
async function getPageBySlug(slug: string) {
  return db.select().from(page).where(eq(page.slug, slug)).get();
}

/**
 * Helper to get a component by ID with workspace scope.
 */
async function getComponentById(id: number, workspaceId: number) {
  return db
    .select()
    .from(pageComponent)
    .where(
      and(eq(pageComponent.id, id), eq(pageComponent.workspaceId, workspaceId)),
    )
    .get();
}

/**
 * Helper to get a component group by ID with workspace scope.
 */
async function getGroupById(id: number, workspaceId: number) {
  return db
    .select()
    .from(pageComponentGroup)
    .where(
      and(
        eq(pageComponentGroup.id, id),
        eq(pageComponentGroup.workspaceId, workspaceId),
      ),
    )
    .get();
}

/**
 * Helper to get a monitor by ID with workspace scope.
 */
async function getMonitorById(id: number, workspaceId: number) {
  return db
    .select()
    .from(monitor)
    .where(and(eq(monitor.id, id), eq(monitor.workspaceId, workspaceId)))
    .get();
}

/**
 * Status page service implementation for ConnectRPC.
 */
export const statusPageServiceImpl: ServiceImpl<typeof StatusPageService> = {
  // ==========================================================================
  // Page CRUD
  // ==========================================================================

  async createStatusPage(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    const workspaceId = rpcCtx.workspace.id;

    // Check if slug already exists
    const existingPage = await getPageBySlug(req.slug);
    if (existingPage) {
      throw slugAlreadyExistsError(req.slug);
    }

    // Create the status page
    const newPage = await db
      .insert(page)
      .values({
        workspaceId,
        title: req.title,
        description: req.description ?? "",
        slug: req.slug,
        customDomain: "",
        published: false,
        homepageUrl: req.homepageUrl ?? null,
        contactUrl: req.contactUrl ?? null,
      })
      .returning()
      .get();

    if (!newPage) {
      throw statusPageCreateFailedError();
    }

    return {
      statusPage: dbPageToProto(newPage),
    };
  },

  async getStatusPage(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    const workspaceId = rpcCtx.workspace.id;

    if (!req.id || req.id.trim() === "") {
      throw statusPageIdRequiredError();
    }

    const pageData = await getPageById(Number(req.id), workspaceId);
    if (!pageData) {
      throw statusPageNotFoundError(req.id);
    }

    return {
      statusPage: dbPageToProto(pageData),
    };
  },

  async listStatusPages(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    const workspaceId = rpcCtx.workspace.id;

    const limit = Math.min(Math.max(req.limit ?? 50, 1), 100);
    const offset = req.offset ?? 0;

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(page)
      .where(eq(page.workspaceId, workspaceId))
      .get();

    const totalCount = countResult?.count ?? 0;

    // Get pages
    const pages = await db
      .select()
      .from(page)
      .where(eq(page.workspaceId, workspaceId))
      .orderBy(desc(page.createdAt))
      .limit(limit)
      .offset(offset)
      .all();

    return {
      statusPages: pages.map(dbPageToProtoSummary),
      totalSize: totalCount,
    };
  },

  async updateStatusPage(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    const workspaceId = rpcCtx.workspace.id;

    if (!req.id || req.id.trim() === "") {
      throw statusPageIdRequiredError();
    }

    const pageData = await getPageById(Number(req.id), workspaceId);
    if (!pageData) {
      throw statusPageNotFoundError(req.id);
    }

    // Check if new slug conflicts with another page
    if (req.slug && req.slug !== pageData.slug) {
      const existingPage = await getPageBySlug(req.slug);
      if (existingPage && existingPage.id !== pageData.id) {
        throw slugAlreadyExistsError(req.slug);
      }
    }

    // Build update values
    const updateValues: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (req.title !== undefined && req.title !== "") {
      updateValues.title = req.title;
    }
    if (req.description !== undefined) {
      updateValues.description = req.description;
    }
    if (req.slug !== undefined && req.slug !== "") {
      updateValues.slug = req.slug;
    }
    if (req.homepageUrl !== undefined) {
      updateValues.homepageUrl = req.homepageUrl || null;
    }
    if (req.contactUrl !== undefined) {
      updateValues.contactUrl = req.contactUrl || null;
    }

    const updatedPage = await db
      .update(page)
      .set(updateValues)
      .where(eq(page.id, pageData.id))
      .returning()
      .get();

    if (!updatedPage) {
      throw statusPageUpdateFailedError(req.id);
    }

    return {
      statusPage: dbPageToProto(updatedPage),
    };
  },

  async deleteStatusPage(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    const workspaceId = rpcCtx.workspace.id;

    if (!req.id || req.id.trim() === "") {
      throw statusPageIdRequiredError();
    }

    const pageData = await getPageById(Number(req.id), workspaceId);
    if (!pageData) {
      throw statusPageNotFoundError(req.id);
    }

    // Delete the page (cascade will delete components, groups, subscribers)
    await db.delete(page).where(eq(page.id, pageData.id));

    return { success: true };
  },

  // ==========================================================================
  // Component Management
  // ==========================================================================

  async addMonitorComponent(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    const workspaceId = rpcCtx.workspace.id;

    // Verify page exists and belongs to workspace
    const pageData = await getPageById(Number(req.pageId), workspaceId);
    if (!pageData) {
      throw statusPageNotFoundError(req.pageId);
    }

    // Verify monitor exists and belongs to workspace
    const monitorData = await getMonitorById(
      Number(req.monitorId),
      workspaceId,
    );
    if (!monitorData) {
      throw monitorNotFoundError(req.monitorId);
    }

    // Validate group exists if provided
    if (req.groupId) {
      const group = await getGroupById(Number(req.groupId), workspaceId);
      if (!group) {
        throw componentGroupNotFoundError(req.groupId);
      }
    }

    // Create the component
    const newComponent = await db
      .insert(pageComponent)
      .values({
        workspaceId,
        pageId: pageData.id,
        type: "monitor",
        monitorId: monitorData.id,
        name: req.name ?? monitorData.name,
        description: req.description ?? null,
        order: req.order ?? 0,
        groupId: req.groupId ? Number(req.groupId) : null,
      })
      .returning()
      .get();

    if (!newComponent) {
      throw pageComponentCreateFailedError();
    }

    return {
      component: dbComponentToProto(newComponent),
    };
  },

  async addExternalComponent(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    const workspaceId = rpcCtx.workspace.id;

    // Verify page exists and belongs to workspace
    const pageData = await getPageById(Number(req.pageId), workspaceId);
    if (!pageData) {
      throw statusPageNotFoundError(req.pageId);
    }

    // Validate group exists if provided
    if (req.groupId) {
      const group = await getGroupById(Number(req.groupId), workspaceId);
      if (!group) {
        throw componentGroupNotFoundError(req.groupId);
      }
    }

    // Create the component
    const newComponent = await db
      .insert(pageComponent)
      .values({
        workspaceId,
        pageId: pageData.id,
        type: "external",
        monitorId: null,
        name: req.name,
        description: req.description ?? null,
        order: req.order ?? 0,
        groupId: req.groupId ? Number(req.groupId) : null,
      })
      .returning()
      .get();

    if (!newComponent) {
      throw pageComponentCreateFailedError();
    }

    return {
      component: dbComponentToProto(newComponent),
    };
  },

  async removeComponent(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    const workspaceId = rpcCtx.workspace.id;

    if (!req.id || req.id.trim() === "") {
      throw pageComponentNotFoundError(req.id);
    }

    const component = await getComponentById(Number(req.id), workspaceId);
    if (!component) {
      throw pageComponentNotFoundError(req.id);
    }

    // Delete the component
    await db.delete(pageComponent).where(eq(pageComponent.id, component.id));

    return { success: true };
  },

  async updateComponent(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    const workspaceId = rpcCtx.workspace.id;

    if (!req.id || req.id.trim() === "") {
      throw pageComponentNotFoundError(req.id);
    }

    const component = await getComponentById(Number(req.id), workspaceId);
    if (!component) {
      throw pageComponentNotFoundError(req.id);
    }

    // Validate group exists if provided
    if (req.groupId !== undefined && req.groupId !== "") {
      const group = await getGroupById(Number(req.groupId), workspaceId);
      if (!group) {
        throw componentGroupNotFoundError(req.groupId);
      }
    }

    // Build update values
    const updateValues: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (req.name !== undefined && req.name !== "") {
      updateValues.name = req.name;
    }
    if (req.description !== undefined) {
      updateValues.description = req.description || null;
    }
    if (req.order !== undefined) {
      updateValues.order = req.order;
    }
    if (req.groupId !== undefined) {
      // Empty string means remove from group
      updateValues.groupId = req.groupId === "" ? null : Number(req.groupId);
    }
    if (req.groupOrder !== undefined) {
      updateValues.groupOrder = req.groupOrder;
    }

    const updatedComponent = await db
      .update(pageComponent)
      .set(updateValues)
      .where(eq(pageComponent.id, component.id))
      .returning()
      .get();

    if (!updatedComponent) {
      throw pageComponentUpdateFailedError(req.id);
    }

    return {
      component: dbComponentToProto(updatedComponent),
    };
  },

  // ==========================================================================
  // Component Groups
  // ==========================================================================

  async createComponentGroup(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    const workspaceId = rpcCtx.workspace.id;

    // Verify page exists and belongs to workspace
    const pageData = await getPageById(Number(req.pageId), workspaceId);
    if (!pageData) {
      throw statusPageNotFoundError(req.pageId);
    }

    // Create the group
    const newGroup = await db
      .insert(pageComponentGroup)
      .values({
        workspaceId,
        pageId: pageData.id,
        name: req.name,
      })
      .returning()
      .get();

    if (!newGroup) {
      throw componentGroupCreateFailedError();
    }

    return {
      group: dbGroupToProto(newGroup),
    };
  },

  async deleteComponentGroup(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    const workspaceId = rpcCtx.workspace.id;

    if (!req.id || req.id.trim() === "") {
      throw componentGroupNotFoundError(req.id);
    }

    const group = await getGroupById(Number(req.id), workspaceId);
    if (!group) {
      throw componentGroupNotFoundError(req.id);
    }

    // Delete the group (components will have groupId set to null due to FK constraint)
    await db
      .delete(pageComponentGroup)
      .where(eq(pageComponentGroup.id, group.id));

    return { success: true };
  },

  async updateComponentGroup(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    const workspaceId = rpcCtx.workspace.id;

    if (!req.id || req.id.trim() === "") {
      throw componentGroupNotFoundError(req.id);
    }

    const group = await getGroupById(Number(req.id), workspaceId);
    if (!group) {
      throw componentGroupNotFoundError(req.id);
    }

    // Build update values
    const updateValues: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (req.name !== undefined && req.name !== "") {
      updateValues.name = req.name;
    }

    const updatedGroup = await db
      .update(pageComponentGroup)
      .set(updateValues)
      .where(eq(pageComponentGroup.id, group.id))
      .returning()
      .get();

    if (!updatedGroup) {
      throw componentGroupUpdateFailedError(req.id);
    }

    return {
      group: dbGroupToProto(updatedGroup),
    };
  },

  // ==========================================================================
  // Subscribers
  // ==========================================================================

  async subscribeToPage(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    const workspaceId = rpcCtx.workspace.id;

    // Verify page exists and belongs to workspace
    const pageData = await getPageById(Number(req.pageId), workspaceId);
    if (!pageData) {
      throw statusPageNotFoundError(req.pageId);
    }

    // Check if already subscribed
    const existingSubscriber = await db
      .select()
      .from(pageSubscriber)
      .where(
        and(
          eq(pageSubscriber.pageId, pageData.id),
          eq(pageSubscriber.email, req.email),
        ),
      )
      .get();

    if (existingSubscriber) {
      // If unsubscribed, resubscribe
      if (existingSubscriber.unsubscribedAt) {
        const updatedSubscriber = await db
          .update(pageSubscriber)
          .set({
            unsubscribedAt: null,
            updatedAt: new Date(),
            token: nanoid(),
          })
          .where(eq(pageSubscriber.id, existingSubscriber.id))
          .returning()
          .get();

        if (!updatedSubscriber) {
          throw subscriberCreateFailedError();
        }

        return {
          subscriber: dbSubscriberToProto(updatedSubscriber),
        };
      }

      // Already subscribed, return existing
      return {
        subscriber: dbSubscriberToProto(existingSubscriber),
      };
    }

    // Create new subscriber
    const newSubscriber = await db
      .insert(pageSubscriber)
      .values({
        pageId: pageData.id,
        email: req.email,
        token: nanoid(),
      })
      .returning()
      .get();

    if (!newSubscriber) {
      throw subscriberCreateFailedError();
    }

    return {
      subscriber: dbSubscriberToProto(newSubscriber),
    };
  },

  async unsubscribeFromPage(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    const workspaceId = rpcCtx.workspace.id;

    // Verify page exists and belongs to workspace
    const pageData = await getPageById(Number(req.pageId), workspaceId);
    if (!pageData) {
      throw statusPageNotFoundError(req.pageId);
    }

    // Find subscriber based on identifier type
    if (req.identifier.case === "email") {
      const subscriber = await db
        .select()
        .from(pageSubscriber)
        .where(
          and(
            eq(pageSubscriber.pageId, pageData.id),
            eq(pageSubscriber.email, req.identifier.value),
          ),
        )
        .get();

      if (!subscriber) {
        throw subscriberNotFoundError(req.identifier.value);
      }

      await db
        .update(pageSubscriber)
        .set({ unsubscribedAt: new Date(), updatedAt: new Date() })
        .where(eq(pageSubscriber.id, subscriber.id));

      return { success: true };
    }

    if (req.identifier.case === "token") {
      const subscriber = await db
        .select()
        .from(pageSubscriber)
        .where(
          and(
            eq(pageSubscriber.pageId, pageData.id),
            eq(pageSubscriber.token, req.identifier.value),
          ),
        )
        .get();

      if (!subscriber) {
        throw subscriberNotFoundError(req.identifier.value);
      }

      await db
        .update(pageSubscriber)
        .set({ unsubscribedAt: new Date(), updatedAt: new Date() })
        .where(eq(pageSubscriber.id, subscriber.id));

      return { success: true };
    }

    throw identifierRequiredError();
  },

  async listSubscribers(req, ctx) {
    const rpcCtx = getRpcContext(ctx);
    const workspaceId = rpcCtx.workspace.id;

    // Verify page exists and belongs to workspace
    const pageData = await getPageById(Number(req.pageId), workspaceId);
    if (!pageData) {
      throw statusPageNotFoundError(req.pageId);
    }

    const limit = Math.min(Math.max(req.limit ?? 50, 1), 100);
    const offset = req.offset ?? 0;

    // Build conditions
    const conditions = [eq(pageSubscriber.pageId, pageData.id)];
    if (!req.includeUnsubscribed) {
      conditions.push(isNull(pageSubscriber.unsubscribedAt));
    }

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(pageSubscriber)
      .where(and(...conditions))
      .get();

    const totalCount = countResult?.count ?? 0;

    // Get subscribers
    const subscribers = await db
      .select()
      .from(pageSubscriber)
      .where(and(...conditions))
      .orderBy(desc(pageSubscriber.createdAt))
      .limit(limit)
      .offset(offset)
      .all();

    return {
      subscribers: subscribers.map(dbSubscriberToProto),
      totalSize: totalCount,
    };
  },

  // ==========================================================================
  // Full Content & Status
  // ==========================================================================

  async getStatusPageContent(req, ctx) {
    // Note: This endpoint may be used publicly, so we need to handle
    // the case where we look up by slug without workspace scope
    type PageData = Awaited<ReturnType<typeof getPageById>>;
    let pageData: PageData = undefined;

    if (req.identifier.case === "id") {
      const rpcCtx = getRpcContext(ctx);
      const workspaceId = rpcCtx.workspace.id;
      pageData = await getPageById(Number(req.identifier.value), workspaceId);
    } else if (req.identifier.case === "slug") {
      pageData = await getPageBySlug(req.identifier.value);
    } else {
      throw statusPageIdRequiredError();
    }

    if (!pageData) {
      throw statusPageNotFoundError(
        req.identifier.case === "id"
          ? req.identifier.value
          : req.identifier.value,
      );
    }

    // Get components
    const components = await db
      .select()
      .from(pageComponent)
      .where(eq(pageComponent.pageId, pageData.id))
      .orderBy(pageComponent.order)
      .all();

    // Get groups
    const groups = await db
      .select()
      .from(pageComponentGroup)
      .where(eq(pageComponentGroup.pageId, pageData.id))
      .all();

    // Get active status reports (not resolved)
    const activeReports = await db
      .select()
      .from(statusReport)
      .where(
        and(
          eq(statusReport.pageId, pageData.id),
          inArray(statusReport.status, [
            "investigating",
            "identified",
            "monitoring",
          ]),
        ),
      )
      .orderBy(desc(statusReport.createdAt))
      .all();

    // Get status report updates for active reports
    const reportIds = activeReports.map((r) => r.id);
    const reportUpdates =
      reportIds.length > 0
        ? await db
            .select()
            .from(statusReportUpdate)
            .where(inArray(statusReportUpdate.statusReportId, reportIds))
            .orderBy(desc(statusReportUpdate.date))
            .all()
        : [];

    // Get page component IDs for each report
    const reportComponents =
      reportIds.length > 0
        ? await db
            .select()
            .from(statusReportsToPageComponents)
            .where(
              inArray(statusReportsToPageComponents.statusReportId, reportIds),
            )
            .all()
        : [];

    // Import the converter from status-report service
    const { dbStatusToProto } = await import("../status-report/converters");

    // Convert reports to proto format
    const statusReports = activeReports.map((report) => {
      const updates = reportUpdates.filter(
        (u) => u.statusReportId === report.id,
      );
      const componentIds = reportComponents
        .filter((rc) => rc.statusReportId === report.id)
        .map((rc) => String(rc.pageComponentId));

      return {
        $typeName: "openstatus.status_report.v1.StatusReport" as const,
        id: String(report.id),
        status: dbStatusToProto(report.status),
        title: report.title,
        pageComponentIds: componentIds,
        updates: updates.map((u) => ({
          $typeName: "openstatus.status_report.v1.StatusReportUpdate" as const,
          id: String(u.id),
          status: dbStatusToProto(u.status),
          date: u.date.toISOString(),
          message: u.message,
          createdAt: u.createdAt?.toISOString() ?? "",
        })),
        createdAt: report.createdAt?.toISOString() ?? "",
        updatedAt: report.updatedAt?.toISOString() ?? "",
      };
    });

    return {
      statusPage: dbPageToProto(pageData),
      components: components.map(dbComponentToProto),
      groups: groups.map(dbGroupToProto),
      statusReports,
      maintenances: [], // TODO: Implement maintenance support
    };
  },

  async getOverallStatus(req, ctx) {
    type PageData = Awaited<ReturnType<typeof getPageById>>;
    let pageData: PageData = undefined;

    if (req.identifier.case === "id") {
      const rpcCtx = getRpcContext(ctx);
      const workspaceId = rpcCtx.workspace.id;
      pageData = await getPageById(Number(req.identifier.value), workspaceId);
    } else if (req.identifier.case === "slug") {
      pageData = await getPageBySlug(req.identifier.value);
    } else {
      throw statusPageIdRequiredError();
    }

    if (!pageData) {
      throw statusPageNotFoundError(
        req.identifier.case === "id"
          ? req.identifier.value
          : req.identifier.value,
      );
    }

    // Get components
    const components = await db
      .select()
      .from(pageComponent)
      .where(eq(pageComponent.pageId, pageData.id))
      .all();

    // Check for active incidents affecting components
    const componentIds = components.map((c) => c.id);
    let hasActiveIncident = false;

    if (componentIds.length > 0) {
      const activeIncidents = await db
        .select()
        .from(statusReportsToPageComponents)
        .innerJoin(
          statusReport,
          eq(statusReportsToPageComponents.statusReportId, statusReport.id),
        )
        .where(
          and(
            inArray(
              statusReportsToPageComponents.pageComponentId,
              componentIds,
            ),
            inArray(statusReport.status, [
              "investigating",
              "identified",
              "monitoring",
            ]),
          ),
        )
        .all();

      hasActiveIncident = activeIncidents.length > 0;
    }

    // Determine overall status
    // In a full implementation, this would check monitor statuses as well
    const overallStatus = hasActiveIncident
      ? OverallStatus.DEGRADED
      : OverallStatus.OPERATIONAL;

    // Build component statuses
    // In a full implementation, this would check each component's monitor status
    const componentStatuses = components.map((c) => ({
      $typeName: "openstatus.status_page.v1.ComponentStatus" as const,
      componentId: String(c.id),
      status: OverallStatus.OPERATIONAL, // Placeholder - would check monitor/incident status
    }));

    return {
      overallStatus,
      componentStatuses,
    };
  },
};
