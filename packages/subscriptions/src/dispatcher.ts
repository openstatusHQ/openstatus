import { and, db, eq, isNotNull, isNull } from "@openstatus/db";
import {
  maintenance,
  page,
  pageSubscriber,
  statusReportUpdate,
} from "@openstatus/db/src/schema";
import { getChannel } from "./channels";
import type { PageUpdate, Subscription } from "./types";

/**
 * Dispatch notifications for a status report update
 */
export async function dispatchStatusReportUpdate(statusReportUpdateId: number) {
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
 */
export async function dispatchMaintenanceUpdate(maintenanceId: number) {
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

  await dispatchPageUpdate({
    id: maintenanceWithComponents.id,
    pageId: maintenanceWithComponents.pageId,
    title: maintenanceWithComponents.title,
    status: "maintenance",
    message: maintenanceWithComponents.message,
    pageComponentIds: pageComponents.map((c) => c.id),
    pageComponents: pageComponents.map((c) => c.name),
    date: `${maintenanceWithComponents.from.toISOString()} - ${maintenanceWithComponents.to.toISOString()}`,
  });
}

/**
 * Dispatch notifications for a page update to all matching subscriptions
 *
 * - Entire page subscriptions (empty componentIds): always notified
 * - Component subscriptions: only notified if any affected component matches
 */
export async function dispatchPageUpdate(pageUpdate: PageUpdate) {
  const affectedComponentIds = pageUpdate.pageComponentIds;

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

  const subscribersWithComponents = await db.query.pageSubscriber.findMany({
    where: and(
      eq(pageSubscriber.pageId, pageUpdate.pageId),
      isNotNull(pageSubscriber.acceptedAt),
      isNull(pageSubscriber.unsubscribedAt),
    ),
    with: {
      components: true,
    },
  });

  const matchingSubscriptions: Subscription[] = subscribersWithComponents
    .map((sub) => ({
      id: sub.id,
      pageId: sub.pageId,
      pageName: pageData.name,
      pageSlug: pageData.slug,
      customDomain: pageData.customDomain,
      channelType: sub.channelType as "email" | "webhook",
      email: sub.email ?? undefined,
      webhookUrl: sub.webhookUrl ?? undefined,
      channelConfig: sub.channelConfig ?? undefined,
      token: sub.token ?? undefined,
      acceptedAt: sub.acceptedAt ?? undefined,
      componentIds: sub.components.map((c) => c.pageComponentId),
    }))
    .filter((sub) => {
      // Entire page subscription matches all updates
      if (sub.componentIds.length === 0) return true;

      // Component subscription: check for overlap
      return affectedComponentIds.some((id) => sub.componentIds.includes(id));
    });

  if (matchingSubscriptions.length === 0) {
    console.log(`No matching subscriptions for page update ${pageUpdate.id}`);
    return;
  }

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

  await Promise.allSettled(
    Object.entries(byChannel).map(async ([channelType, subs]) => {
      const channel = getChannel(channelType);
      if (!channel) {
        console.error(`Unknown channel type: ${channelType}`);
        return;
      }

      try {
        await channel.sendNotifications(subs, pageUpdate);
        console.log(`Sent ${subs.length} notifications via ${channelType}`);
      } catch (error) {
        console.error(
          `Failed to send notifications via ${channelType}:`,
          error,
        );
      }
    }),
  );
}
