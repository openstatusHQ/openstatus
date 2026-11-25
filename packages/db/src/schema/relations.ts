import { defineRelations } from "drizzle-orm";

import * as schema from "./index";

export const relations = defineRelations(schema, (r) => ({
  workspace: {
    usersToWorkspaces: r.many.usersToWorkspaces(),
    pages: r.many.page(),
    monitors: r.many.monitor(),
    notifications: r.many.notification(),
    statusReports: r.many.statusReport(),
    ssoDomains: r.many.workspaceSsoDomain(),
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
    createdByUser: r.one.user({
      from: r.statusReport.createdBy,
      to: r.user.id,
      alias: "statusReportCreatedBy",
    }),
    updatedByUser: r.one.user({
      from: r.statusReport.updatedBy,
      to: r.user.id,
      alias: "statusReportUpdatedBy",
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
    createdByUser: r.one.user({
      from: r.statusReportUpdate.createdBy,
      to: r.user.id,
      alias: "statusReportUpdateCreatedBy",
    }),
    updatedByUser: r.one.user({
      from: r.statusReportUpdate.updatedBy,
      to: r.user.id,
      alias: "statusReportUpdateUpdatedBy",
    }),
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

  monitorIncidentTable: {
    monitor: r.one.monitor({
      from: r.monitorIncidentTable.monitorId,
      to: r.monitor.id,
    }),
    workspace: r.one.workspace({
      from: r.monitorIncidentTable.workspaceId,
      to: r.workspace.id,
    }),
    acknowledgedByUser: r.one.user({
      from: r.monitorIncidentTable.acknowledgedBy,
      to: r.user.id,
      alias: "monitorIncidentAcknowledgedBy",
    }),
    resolvedByUser: r.one.user({
      from: r.monitorIncidentTable.resolvedBy,
      to: r.user.id,
      alias: "monitorIncidentResolvedBy",
    }),
    excusedByUser: r.one.user({
      from: r.monitorIncidentTable.excusedBy,
      to: r.user.id,
      alias: "monitorIncidentExcusedBy",
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
    maintenanceUpdates: r.many.maintenanceUpdate(),
    page: r.one.page({
      from: r.maintenance.pageId,
      to: r.page.id,
    }),
    workspace: r.one.workspace({
      from: r.maintenance.workspaceId,
      to: r.workspace.id,
    }),
    createdByUser: r.one.user({
      from: r.maintenance.createdBy,
      to: r.user.id,
      alias: "maintenanceCreatedBy",
    }),
    updatedByUser: r.one.user({
      from: r.maintenance.updatedBy,
      to: r.user.id,
      alias: "maintenanceUpdatedBy",
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
    }),
    monitorsToNotifications: r.many.notificationsToMonitors(),
    monitorIncidents: r.many.monitorIncidentTable(),
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

  maintenanceUpdate: {
    maintenance: r.one.maintenance({
      from: r.maintenanceUpdate.maintenanceId,
      to: r.maintenance.id,
      optional: false,
    }),
    createdByUser: r.one.user({
      from: r.maintenanceUpdate.createdBy,
      to: r.user.id,
      alias: "maintenanceUpdateCreatedBy",
    }),
    updatedByUser: r.one.user({
      from: r.maintenanceUpdate.updatedBy,
      to: r.user.id,
      alias: "maintenanceUpdateUpdatedBy",
    }),
  },

  workspaceSsoDomain: {
    workspace: r.one.workspace({
      from: r.workspaceSsoDomain.workspaceId,
      to: r.workspace.id,
      optional: false,
    }),
  },

  incident: {
    workspace: r.one.workspace({
      from: r.incident.workspaceId,
      to: r.workspace.id,
      optional: false,
    }),
    commander: r.one.user({
      from: r.incident.commanderId,
      to: r.user.id,
      alias: "incidentCommander",
    }),
    declaredByUser: r.one.user({
      from: r.incident.declaredBy,
      to: r.user.id,
      alias: "incidentDeclaredBy",
    }),
    resolvedByUser: r.one.user({
      from: r.incident.resolvedBy,
      to: r.user.id,
      alias: "incidentResolvedBy",
    }),
    acknowledgedByUser: r.one.user({
      from: r.incident.acknowledgedBy,
      to: r.user.id,
      alias: "incidentAcknowledgedBy",
    }),
    statusReport: r.one.statusReport({
      from: r.incident.statusReportId,
      to: r.statusReport.id,
    }),
    events: r.many.incidentEvent(),
  },

  incidentEvent: {
    incident: r.one.incident({
      from: r.incidentEvent.incidentId,
      to: r.incident.id,
      optional: false,
    }),
    createdByUser: r.one.user({
      from: r.incidentEvent.createdBy,
      to: r.user.id,
    }),
  },

  incidentPostmortem: {
    incident: r.one.incident({
      from: r.incidentPostmortem.incidentId,
      to: r.incident.id,
      optional: false,
    }),
    approvedByUser: r.one.user({
      from: r.incidentPostmortem.approvedBy,
      to: r.user.id,
    }),
  },

  notificationOutbox: {
    monitor: r.one.monitor({
      from: r.notificationOutbox.monitorId,
      to: r.monitor.id,
      optional: false,
    }),
    notification: r.one.notification({
      from: r.notificationOutbox.notificationId,
      to: r.notification.id,
      optional: false,
    }),
    incident: r.one.monitorIncidentTable({
      from: r.notificationOutbox.incidentId,
      to: r.monitorIncidentTable.id,
    }),
  },

  monitorTransition: {
    monitor: r.one.monitor({
      from: r.monitorTransition.monitorId,
      to: r.monitor.id,
      optional: false,
    }),
  },

  monitorHeartbeatState: {
    monitor: r.one.monitor({
      from: r.monitorHeartbeatState.monitorId,
      to: r.monitor.id,
      optional: false,
    }),
  },

  frozenMonitorUptime: {
    monitor: r.one.monitor({
      from: r.frozenMonitorUptime.monitorId,
      to: r.monitor.id,
      optional: false,
    }),
    workspace: r.one.workspace({
      from: r.frozenMonitorUptime.workspaceId,
      to: r.workspace.id,
      optional: false,
    }),
  },

  privateLocationMonitorStatus: {
    monitor: r.one.monitor({
      from: r.privateLocationMonitorStatus.monitorId,
      to: r.monitor.id,
      optional: false,
    }),
    privateLocation: r.one.privateLocation({
      from: r.privateLocationMonitorStatus.privateLocationId,
      to: r.privateLocation.id,
      optional: false,
    }),
  },

  monitorMaintenanceWindow: {
    workspace: r.one.workspace({
      from: r.monitorMaintenanceWindow.workspaceId,
      to: r.workspace.id,
      optional: false,
    }),
    monitors: r.many.monitorMaintenanceWindowToMonitor(),
    createdByUser: r.one.user({
      from: r.monitorMaintenanceWindow.createdBy,
      to: r.user.id,
      alias: "monitorMaintenanceWindowCreatedBy",
    }),
    updatedByUser: r.one.user({
      from: r.monitorMaintenanceWindow.updatedBy,
      to: r.user.id,
      alias: "monitorMaintenanceWindowUpdatedBy",
    }),
  },

  monitorMaintenanceWindowToMonitor: {
    window: r.one.monitorMaintenanceWindow({
      from: r.monitorMaintenanceWindowToMonitor.monitorMaintenanceWindowId,
      to: r.monitorMaintenanceWindow.id,
      optional: false,
    }),
    monitor: r.one.monitor({
      from: r.monitorMaintenanceWindowToMonitor.monitorId,
      to: r.monitor.id,
      optional: false,
    }),
  },

  slackUser: {
    workspace: r.one.workspace({
      from: r.slackUser.workspaceId,
      to: r.workspace.id,
      optional: false,
    }),
    user: r.one.user({
      from: r.slackUser.userId,
      to: r.user.id,
      optional: false,
    }),
  },

  oauthClient: {
    sessions: r.many.oauthSession(),
    authorizationCodes: r.many.oauthAuthorizationCode(),
    grants: r.many.oauthGrant(),
  },

  oauthSession: {
    client: r.one.oauthClient({
      from: r.oauthSession.clientId,
      to: r.oauthClient.clientId,
      optional: false,
    }),
  },

  oauthGrant: {
    client: r.one.oauthClient({
      from: r.oauthGrant.clientId,
      to: r.oauthClient.clientId,
      optional: false,
    }),
    user: r.one.user({
      from: r.oauthGrant.userId,
      to: r.user.id,
      optional: false,
    }),
    workspace: r.one.workspace({
      from: r.oauthGrant.workspaceId,
      to: r.workspace.id,
      optional: false,
    }),
  },

  oauthAuthorizationCode: {
    client: r.one.oauthClient({
      from: r.oauthAuthorizationCode.clientId,
      to: r.oauthClient.clientId,
      optional: false,
    }),
    grant: r.one.oauthGrant({
      from: r.oauthAuthorizationCode.grantId,
      to: r.oauthGrant.id,
    }),
    user: r.one.user({
      from: r.oauthAuthorizationCode.userId,
      to: r.user.id,
      optional: false,
    }),
    workspace: r.one.workspace({
      from: r.oauthAuthorizationCode.workspaceId,
      to: r.workspace.id,
      optional: false,
    }),
  },
}));
