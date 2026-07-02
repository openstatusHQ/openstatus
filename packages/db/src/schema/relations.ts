import { defineRelations } from "drizzle-orm";

import * as schema from "./index";

export const relations = defineRelations(schema, (r) => ({
  workspace: {
    usersToWorkspaces: r.many.usersToWorkspaces(),
    pages: r.many.page(),
    monitors: r.many.monitor(),
    notifications: r.many.notification(),
    users: r.many.user({
      from: r.workspace.id.through(r.usersToWorkspaces.workspaceId),
      to: r.user.id.through(r.usersToWorkspaces.userId),
    }),
  },

  user: {
    usersToWorkspaces: r.many.usersToWorkspaces(),
    workspaces: r.many.workspace({
      from: r.user.id.through(r.usersToWorkspaces.userId),
      to: r.workspace.id.through(r.usersToWorkspaces.workspaceId),
    }),
  },

  usersToWorkspaces: {
    workspace: r.one.workspace({
      from: r.usersToWorkspaces.workspaceId,
      to: r.workspace.id,
      optional: false,
    }),
    user: r.one.user({
      from: r.usersToWorkspaces.userId,
      to: r.user.id,
      optional: false,
    }),
  },

  statusReport: {
    statusReportsToPageComponents: r.many.statusReportsToPageComponents(),
    page: r.one.page({
      from: r.statusReport.pageId,
      to: r.page.id,
    }),
    statusReportUpdates: r.many.statusReportUpdate(),
    workspace: r.one.workspace({
      from: r.statusReport.workspaceId,
      to: r.workspace.id,
    }),
    pageComponents: r.many.pageComponent({
      from: r.statusReport.id.through(
        r.statusReportsToPageComponents.statusReportId,
      ),
      to: r.pageComponent.id.through(
        r.statusReportsToPageComponents.pageComponentId,
      ),
    }),
  },

  statusReportUpdate: {
    statusReport: r.one.statusReport({
      from: r.statusReportUpdate.statusReportId,
      to: r.statusReport.id,
      optional: false,
    }),
    statusReportUpdateToPageComponents:
      r.many.statusReportUpdateToPageComponents(),
    pageComponents: r.many.pageComponent({
      from: r.statusReportUpdate.id.through(
        r.statusReportUpdateToPageComponents.statusReportUpdateId,
      ),
      to: r.pageComponent.id.through(
        r.statusReportUpdateToPageComponents.pageComponentId,
      ),
    }),
  },

  page: {
    maintenances: r.many.maintenance(),
    statusReports: r.many.statusReport(),
    workspace: r.one.workspace({
      from: r.page.workspaceId,
      to: r.workspace.id,
      optional: false,
    }),
    pageSubscribers: r.many.pageSubscriber(),
    pageComponents: r.many.pageComponent(),
    pageComponentGroups: r.many.pageComponentGroup(),
  },

  pageSubscriber: {
    page: r.one.page({
      from: r.pageSubscriber.pageId,
      to: r.page.id,
      optional: false,
    }),
    components: r.many.pageSubscriberToPageComponent(),
  },

  pageSubscriberToPageComponent: {
    pageSubscriber: r.one.pageSubscriber({
      from: r.pageSubscriberToPageComponent.pageSubscriberId,
      to: r.pageSubscriber.id,
      optional: false,
    }),
    pageComponent: r.one.pageComponent({
      from: r.pageSubscriberToPageComponent.pageComponentId,
      to: r.pageComponent.id,
      optional: false,
    }),
  },

  notificationsToMonitors: {
    monitor: r.one.monitor({
      from: r.notificationsToMonitors.monitorId,
      to: r.monitor.id,
      optional: false,
    }),
    notification: r.one.notification({
      from: r.notificationsToMonitors.notificationId,
      to: r.notification.id,
      optional: false,
    }),
  },

  notification: {
    workspace: r.one.workspace({
      from: r.notification.workspaceId,
      to: r.workspace.id,
      optional: false,
    }),
    monitor: r.many.notificationsToMonitors(),
    monitors: r.many.monitor({
      from: r.notification.id.through(r.notificationsToMonitors.notificationId),
      to: r.monitor.id.through(r.notificationsToMonitors.monitorId),
    }),
  },

  monitorStatusTable: {
    monitor: r.one.monitor({
      from: r.monitorStatusTable.monitorId,
      to: r.monitor.id,
      optional: false,
    }),
  },

  invitation: {
    workspace: r.one.workspace({
      from: r.invitation.workspaceId,
      to: r.workspace.id,
      optional: false,
    }),
  },

  incidentTable: {
    monitor: r.one.monitor({
      from: r.incidentTable.monitorId,
      to: r.monitor.id,
      optional: false,
    }),
    workspace: r.one.workspace({
      from: r.incidentTable.workspaceId,
      to: r.workspace.id,
      optional: false,
    }),
    acknowledgedByUser: r.one.user({
      from: r.incidentTable.acknowledgedBy,
      to: r.user.id,
      alias: "incident_acknowledged_by",
    }),
    resolvedByUser: r.one.user({
      from: r.incidentTable.resolvedBy,
      to: r.user.id,
      alias: "incident_resolved_by",
    }),
  },

  monitorTagsToMonitors: {
    monitor: r.one.monitor({
      from: r.monitorTagsToMonitors.monitorId,
      to: r.monitor.id,
      optional: false,
    }),
    monitorTag: r.one.monitorTag({
      from: r.monitorTagsToMonitors.monitorTagId,
      to: r.monitorTag.id,
      optional: false,
    }),
  },

  monitorTag: {
    monitor: r.many.monitorTagsToMonitors(),
    workspace: r.one.workspace({
      from: r.monitorTag.workspaceId,
      to: r.workspace.id,
      optional: false,
    }),
    monitors: r.many.monitor({
      from: r.monitorTag.id.through(r.monitorTagsToMonitors.monitorTagId),
      to: r.monitor.id.through(r.monitorTagsToMonitors.monitorId),
    }),
  },

  maintenance: {
    maintenancesToPageComponents: r.many.maintenancesToPageComponents(),
    page: r.one.page({
      from: r.maintenance.pageId,
      to: r.page.id,
      optional: false,
    }),
    workspace: r.one.workspace({
      from: r.maintenance.workspaceId,
      to: r.workspace.id,
      optional: false,
    }),
    pageComponents: r.many.pageComponent({
      from: r.maintenance.id.through(
        r.maintenancesToPageComponents.maintenanceId,
      ),
      to: r.pageComponent.id.through(
        r.maintenancesToPageComponents.pageComponentId,
      ),
    }),
  },

  privateLocation: {
    privateLocationToMonitors: r.many.privateLocationToMonitors(),
    workspace: r.one.workspace({
      from: r.privateLocation.workspaceId,
      to: r.workspace.id,
      optional: false,
    }),
    monitors: r.many.monitor({
      from: r.privateLocation.id.through(
        r.privateLocationToMonitors.privateLocationId,
      ),
      to: r.monitor.id.through(r.privateLocationToMonitors.monitorId),
    }),
  },

  privateLocationToMonitors: {
    privateLocation: r.one.privateLocation({
      from: r.privateLocationToMonitors.privateLocationId,
      to: r.privateLocation.id,
    }),
    monitor: r.one.monitor({
      from: r.privateLocationToMonitors.monitorId,
      to: r.monitor.id,
    }),
  },

  apiKey: {
    workspace: r.one.workspace({
      from: r.apiKey.workspaceId,
      to: r.workspace.id,
      optional: false,
    }),
    createdBy: r.one.user({
      from: r.apiKey.createdById,
      to: r.user.id,
      optional: false,
    }),
  },

  pageComponent: {
    workspace: r.one.workspace({
      from: r.pageComponent.workspaceId,
      to: r.workspace.id,
      optional: false,
    }),
    page: r.one.page({
      from: r.pageComponent.pageId,
      to: r.page.id,
      optional: false,
    }),
    monitor: r.one.monitor({
      from: r.pageComponent.monitorId,
      to: r.monitor.id,
    }),
    group: r.one.pageComponentGroup({
      from: r.pageComponent.groupId,
      to: r.pageComponentGroup.id,
    }),
    statusReportsToPageComponents: r.many.statusReportsToPageComponents(),
    statusReportUpdateToPageComponents:
      r.many.statusReportUpdateToPageComponents(),
    maintenancesToPageComponents: r.many.maintenancesToPageComponents(),
  },

  maintenancesToPageComponents: {
    maintenance: r.one.maintenance({
      from: r.maintenancesToPageComponents.maintenanceId,
      to: r.maintenance.id,
      optional: false,
    }),
    pageComponent: r.one.pageComponent({
      from: r.maintenancesToPageComponents.pageComponentId,
      to: r.pageComponent.id,
      optional: false,
    }),
  },

  statusReportsToPageComponents: {
    statusReport: r.one.statusReport({
      from: r.statusReportsToPageComponents.statusReportId,
      to: r.statusReport.id,
      optional: false,
    }),
    pageComponent: r.one.pageComponent({
      from: r.statusReportsToPageComponents.pageComponentId,
      to: r.pageComponent.id,
      optional: false,
    }),
  },

  statusReportUpdateToPageComponents: {
    statusReportUpdate: r.one.statusReportUpdate({
      from: r.statusReportUpdateToPageComponents.statusReportUpdateId,
      to: r.statusReportUpdate.id,
      optional: false,
    }),
    pageComponent: r.one.pageComponent({
      from: r.statusReportUpdateToPageComponents.pageComponentId,
      to: r.pageComponent.id,
      optional: false,
    }),
  },

  pageComponentGroup: {
    workspace: r.one.workspace({
      from: r.pageComponentGroup.workspaceId,
      to: r.workspace.id,
      optional: false,
    }),
    page: r.one.page({
      from: r.pageComponentGroup.pageId,
      to: r.page.id,
      optional: false,
    }),
    pageComponents: r.many.pageComponent(),
  },

  feedback: {
    workspace: r.one.workspace({
      from: r.feedback.workspaceId,
      to: r.workspace.id,
      optional: false,
    }),
    user: r.one.user({
      from: r.feedback.userId,
      to: r.user.id,
      optional: false,
    }),
  },

  monitor: {
    monitorTagsToMonitors: r.many.monitorTagsToMonitors(),
    workspace: r.one.workspace({
      from: r.monitor.workspaceId,
      to: r.workspace.id,
      optional: false,
    }),
    monitorsToNotifications: r.many.notificationsToMonitors(),
    incidents: r.many.incidentTable(),
    monitorStatus: r.many.monitorStatusTable(),
    privateLocationToMonitors: r.many.privateLocationToMonitors(),
    monitorTags: r.many.monitorTag({
      from: r.monitor.id.through(r.monitorTagsToMonitors.monitorId),
      to: r.monitorTag.id.through(r.monitorTagsToMonitors.monitorTagId),
    }),
    notifications: r.many.notification({
      from: r.monitor.id.through(r.notificationsToMonitors.monitorId),
      to: r.notification.id.through(r.notificationsToMonitors.notificationId),
    }),
    privateLocations: r.many.privateLocation({
      from: r.monitor.id.through(r.privateLocationToMonitors.monitorId),
      to: r.privateLocation.id.through(
        r.privateLocationToMonitors.privateLocationId,
      ),
    }),
  },
}));
