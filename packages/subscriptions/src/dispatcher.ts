import { and, db, eq, isNotNull, isNull, sql } from "@openstatus/db";
import {
  maintenance,
  page,
  pageSubscription,
  pageSubscriptionToPageComponent,
  statusReportUpdate,
} from "@openstatus/db/src/schema";
import { getChannel } from "./channels";
import type { PageUpdate, Subscription } from "./types";

/**
 * Subscription Notification Dispatcher
 * Handles matching subscriptions to page updates (status reports, maintenance, etc.)
 * and dispatching notifications via the appropriate channels
 */

/**
 * Dispatch notifications for a status report update
 * Queries the status report update and parent report with components
 *
 * @param statusReportUpdateId - The ID of the status report update
 */
export async function dispatchStatusReportUpdate(statusReportUpdateId: number) {
  // Get status report update with parent report and components
  const update = await db.query.statusReportUpdate.findFirst({
    where: eq(statusReportUpdate.id, statusReportUpdateId),
    with: {
      statusReport: {
        with: {
          statusReportsToPageComponents: {
            with: { pageComponent: true },
          },
        },
      },
    },
  });

  if (!update?.statusReport) {
    console.error(`Status report update ${statusReportUpdateId} not found`);
    return;
  }

  if (!update.statusReport.pageId) {
    console.error(`Status report ${update.statusReport.id} has no page ID`);
    return;
  }

  const pageComponents = update.statusReport.statusReportsToPageComponents.map(
    (i) => i.pageComponent,
  );

  // Format as PageUpdate and dispatch
  await dispatchPageUpdate({
    id: update.statusReport.id,
    pageId: update.statusReport.pageId,
    title: update.statusReport.title,
    status: update.status as PageUpdate["status"],
    message: update.message,
    pageComponentIds: pageComponents.map((c) => c.id),
    pageComponents: pageComponents.map((c) => c.name),
    date: update.date.toISOString(),
  });
}

/**
 * Dispatch notifications for a maintenance update
 * Queries the maintenance and formats it as a PageUpdate
 *
 * @param maintenanceId - The ID of the maintenance record
 */
export async function dispatchMaintenanceUpdate(maintenanceId: number) {
  // Get maintenance with components
  const maintenanceWithComponents = await db.query.maintenance.findFirst({
    where: eq(maintenance.id, maintenanceId),
    with: {
      maintenancesToPageComponents: {
        with: { pageComponent: true },
      },
    },
  });

  if (!maintenanceWithComponents) {
    console.error(`Maintenance ${maintenanceId} not found`);
    return;
  }

  if (!maintenanceWithComponents.pageId) {
    console.error(`Maintenance ${maintenanceId} has no page ID`);
    return;
  }

  const pageComponents =
    maintenanceWithComponents.maintenancesToPageComponents.map(
      (i) => i.pageComponent,
    );

  // Format as PageUpdate and dispatch
  await dispatchPageUpdate({
    id: maintenanceWithComponents.id,
    pageId: maintenanceWithComponents.pageId,
    title: maintenanceWithComponents.title,
    status: "maintenance",
    message: maintenanceWithComponents.message,
    pageComponentIds: pageComponents.map((c) => c.id),
    pageComponents: pageComponents.map((c) => c.name),
    date: maintenanceWithComponents.from.toISOString(),
  });
}

/**
 * When a page update (status report/maintenance) is created/updated, find all matching subscriptions
 * and send notifications in batches per channel
 *
 * @param pageUpdate - The page update event
 */
export async function dispatchPageUpdate(pageUpdate: PageUpdate) {
  const affectedComponentIds = pageUpdate.pageComponentIds;

  // Fetch page data for email templates
  const pageData = await db
    .select({
      id: page.id,
      name: page.title,
      slug: page.slug,
      customDomain: page.customDomain,
    })
    .from(page)
    .where(eq(page.id, pageUpdate.pageId))
    .get();

  if (!pageData) {
    console.error(`Page ${pageUpdate.pageId} not found`);
    return;
  }

  // Optimized query: Single LEFT JOIN with GROUP_CONCAT
  // Fetches all subscriptions with their component IDs in one query
  const subscriptionsWithComponents = await db
    .select({
      id: pageSubscription.id,
      email: pageSubscription.email,
      webhookUrl: pageSubscription.webhookUrl,
      pageId: pageSubscription.pageId,
      workspaceId: pageSubscription.workspaceId,
      channelType: pageSubscription.channelType,
      channelConfig: pageSubscription.channelConfig,
      token: pageSubscription.token,
      verifiedAt: pageSubscription.verifiedAt,
      // Aggregate component IDs as comma-separated string (NULL if empty)
      componentIds: sql<string>`GROUP_CONCAT(${pageSubscriptionToPageComponent.pageComponentId})`,
    })
    .from(pageSubscription)
    .leftJoin(
      pageSubscriptionToPageComponent,
      eq(
        pageSubscription.id,
        pageSubscriptionToPageComponent.pageSubscriptionId,
      ),
    )
    .where(
      and(
        eq(pageSubscription.pageId, pageUpdate.pageId),
        isNotNull(pageSubscription.verifiedAt),
        isNull(pageSubscription.unsubscribedAt),
      ),
    )
    .groupBy(pageSubscription.id)
    .all();

  // Parse component IDs, add page data, and filter by page update scope
  const matchingSubscriptions: Subscription[] = subscriptionsWithComponents
    .map((sub) => ({
      id: sub.id,
      pageId: sub.pageId,
      pageName: pageData.name,
      pageSlug: pageData.slug,
      customDomain: pageData.customDomain,
      workspaceId: sub.workspaceId,
      channelType: sub.channelType as "email" | "webhook",
      email: sub.email ?? undefined,
      webhookUrl: sub.webhookUrl ?? undefined,
      channelConfig: sub.channelConfig ?? undefined,
      token: sub.token,
      verifiedAt: sub.verifiedAt ?? undefined,
      componentIds: sub.componentIds
        ? sub.componentIds.split(",").map(Number)
        : [], // Empty = entire page subscription (NULL from GROUP_CONCAT)
    }))
    .filter((sub) => {
      // Entire page subscription (empty componentIds) matches all page updates
      if (sub.componentIds.length === 0) return true;

      // Check if any affected component is in the subscribed list
      return affectedComponentIds.some((affectedId) =>
        sub.componentIds.includes(affectedId),
      );
    });

  if (matchingSubscriptions.length === 0) {
    console.log(`No matching subscriptions for page update ${pageUpdate.id}`);
    return;
  }

  // Group subscriptions by channel type for batched sending
  const byChannel = matchingSubscriptions.reduce(
    (acc, sub) => {
      if (!acc[sub.channelType]) {
        acc[sub.channelType] = [];
      }
      acc[sub.channelType].push(sub);
      return acc;
    },
    {} as Record<string, Subscription[]>,
  );

  // Send notifications per channel (batched)
  await Promise.allSettled(
    Object.entries(byChannel).map(async ([channelType, subs]) => {
      const channel = getChannel(channelType);
      if (!channel) {
        console.error(`Unknown channel type: ${channelType}`);
        return;
      }

      try {
        // Send batched notifications (email: chunks of 100, webhook: parallel)
        await channel.sendNotifications(subs, pageUpdate);
        console.log(`Sent ${subs.length} notifications via ${channelType}`);
      } catch (error) {
        console.error(
          `Failed to send notifications via ${channelType}:`,
          error,
        );
        // TODO: Retry logic, dead letter queue
      }
    }),
  );
}
