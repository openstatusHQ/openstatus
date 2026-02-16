import { and, db, eq, isNotNull, isNull } from "@openstatus/db";
import {
  maintenance,
  page,
  pageSubscription,
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
 *
 * Fetches the status report update with its parent report and components,
 * then dispatches notifications to all matching subscriptions.
 *
 * @param statusReportUpdateId - The ID of the status report update
 *
 * @example
 * ```ts
 * // Called when a new status report update is created
 * await dispatchStatusReportUpdate(updateId);
 * ```
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
 *
 * Fetches the maintenance record with its components, formats it as a page update,
 * then dispatches notifications to all matching subscriptions.
 *
 * @param maintenanceId - The ID of the maintenance record
 *
 * @example
 * ```ts
 * // Called when a maintenance window is scheduled/started
 * await dispatchMaintenanceUpdate(maintenanceId);
 * ```
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
 * Dispatch notifications for a page update to all matching subscriptions
 *
 * Finds all verified, active subscriptions for the page and sends notifications
 * via their configured channels (email, webhook). Subscriptions are filtered by
 * component scope - component-specific subscriptions only receive notifications
 * for updates affecting their subscribed components.
 *
 * @param pageUpdate - The page update event
 * @param pageUpdate.id - Update ID (status report or maintenance)
 * @param pageUpdate.pageId - Page ID
 * @param pageUpdate.title - Update title
 * @param pageUpdate.status - Status (investigating, identified, monitoring, resolved, maintenance)
 * @param pageUpdate.message - Update message
 * @param pageUpdate.pageComponentIds - Component IDs affected by this update
 * @param pageUpdate.pageComponents - Component names affected by this update
 * @param pageUpdate.date - Update timestamp (ISO string)
 *
 * @example
 * ```ts
 * await dispatchPageUpdate({
 *   id: 1,
 *   pageId: 123,
 *   title: "API Degradation",
 *   status: "investigating",
 *   message: "We're investigating slow response times",
 *   pageComponentIds: [1, 2],
 *   pageComponents: ["API", "Database"],
 *   date: new Date().toISOString()
 * });
 * ```
 *
 * Notification behavior:
 * - Email: Sent in batches of 100 (via Resend batch API)
 * - Webhook: Sent in parallel with individual requests
 * - Entire page subscriptions (no components): Always notified
 * - Component subscriptions: Only notified if any affected component matches
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

  // Fetch subscriptions with their components using relational query
  const subscriptionsWithComponents = await db.query.pageSubscription.findMany({
    where: and(
      eq(pageSubscription.pageId, pageUpdate.pageId),
      isNotNull(pageSubscription.verifiedAt),
      isNull(pageSubscription.unsubscribedAt),
    ),
    with: {
      components: true,
    },
  });

  // Map to internal format and filter by page update scope
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
      componentIds: sub.components.map((c) => c.pageComponentId),
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
