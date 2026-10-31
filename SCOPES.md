# Scopes

Every credential (API key, OAuth grant) holds a list of scopes. Every verb,
route and tool requires exactly one. The convention is one shape only:

```
<group>:read | <group>:write          group ∈ monitors, pages, incidents, notifications, subscribers
```

plus three umbrellas and two values nothing can hold. Nothing else is valid:
`Scope` and `RequiredScope` in `packages/db/src/schema/api-keys/constants.ts`
are string-literal unions, so a typo like `monitor:read` or `page.write` is a
compile error at every `requireScope(ctx, …)`, tool `scope:` and middleware
mount. Lint (`openstatus/services-no-legacy-scope`) rejects a bare `"read"` /
`"write"` in `packages/services` and `apps/server`.

## The 15 values

| Value | Settable | Satisfied by | Meaning |
| --- | --- | --- | --- |
| `monitors:read` | yes | itself, `monitors:write`, `read`, `write`, `*` | list and inspect monitors, tags, private locations, monitor incidents, response logs, uptime history |
| `monitors:write` | yes | itself, `write`, `*` | create, update, delete monitors and private locations; link tags and notification channels; on-demand checks and probes; acknowledge or resolve monitor incidents; freeze uptime |
| `pages:read` | yes | itself, `pages:write`, `read`, `write`, `*` | list pages and components, slug and custom-domain lookups, import preview |
| `pages:write` | yes | itself, `write`, `*` | create, update, delete pages, components and groups; provider import (also needs `monitors:write` and `incidents:write`, plus `subscribers:write` when subscribers are included) |
| `incidents:read` | yes | itself, `incidents:write`, `read`, `write`, `*` | list status reports, managed incidents, their events, postmortems, maintenances |
| `incidents:write` | yes | itself, `write`, `*` | every mutation on status reports, updates, managed incidents, postmortems, maintenances, and their notifications |
| `notifications:read` | yes | itself, `notifications:write`, `read`, `write`, `*` | list notification channels (credentials never returned) |
| `notifications:write` | yes | itself, `write`, `*` | create, update, delete channels; send a test notification |
| `subscribers:read` | yes | itself, `subscribers:write`, `read`, `write`, `*` | list and count subscribers (emails, webhook targets) |
| `subscribers:write` | yes | itself, `write`, `*` | create, update, unsubscribe, delete subscribers; test webhooks |
| `read` | yes, legacy | itself, `write`, `*` | every `<group>:read`; audit-log tools (snapshots span every group) |
| `write` | yes, legacy | itself, `*` | every `<group>:read` and `<group>:write`. Full access for Terraform, the CLI and CI |
| `*` | no | itself | super-admin token and dev keys only. Satisfies everything, including `admin` |
| `admin` | never held | `*` | required by workspace, billing, members, invitations, API keys, OAuth clients, SSO, integrations and account deletion. No key or grant can reach these |
| `any` | never held | any non-empty credential | public content and docs tools, `get_workspace`, `/v1/whoami` |

Matching lives in one place, `packages/services/src/auth/matches-scope.ts`.

## Presets

| Preset | Scopes | Offered on |
| --- | --- | --- |
| Read only | `read` | API key form, consent screen |
| Read & write | `write` | API key form, consent screen (only when the client requested `write`; default when a client sends no `scope`) |
| Custom | any mix | both |

`scopePresets` in `constants.ts` is the source; the consent screen and the API
key form read it.

## Where each surface enforces

| Surface | Gate | Mapping |
| --- | --- | --- |
| Service verbs | `requireScope(ctx, …)` first line of every exported verb | see the table below |
| V1 REST | `requireGroupScope(group)` per sub-router, `GET`/`HEAD` → `:read`, else `:write` | `/monitor`, `/check` → monitors · `/page` → pages · `/status_report`, `/status_report_update`, `/incident`, `/maintenance` → incidents · `/notification` → notifications · `/page_subscriber` → subscribers · `/whoami` → `any` |
| RPC (ConnectRPC) | `scopeInterceptor` after auth, then the service verb | `MonitorService`, `PrivateLocationService` → monitors · `StatusPageService` → pages, except methods matching `/subscri/i` → subscribers · `StatusReportService`, `IncidentService`, `MaintenanceService` → incidents · `NotificationService` → notifications · `HealthService` unmapped. Read = proto `NO_SIDE_EFFECTS` or `Get*`/`List*` |
| MCP, dashboard chat, Slack | tool `scope` filters `tools/list`; the verb gates the call | see the tool table |
| OAuth | `parseScopeParam` validates the request, `decideSession` checks granted ⊆ requested | 12 settable values |

## Service verbs by scope

Generated from `requireScope` calls on 2026-10-30. Regenerate with
`grep -rn 'requireScope(ctx, "' packages/services/src --include='*.ts' | grep -v __tests__`.

| Scope | Verbs |
| --- | --- |
| `monitors:read` | getMonitor, listMonitors, listMonitorTags, getMonitorStatus, getMonitorSummary, getResponseLog, getResponseLogFacets, listResponseLogs, listResponseLogsInfinite, getMonitorIncident, listMonitorIncidents, getUptimeHistory |
| `monitors:write` | createMonitor, cloneMonitor, deleteMonitor, deleteMonitors, bulkUpdateMonitors, updateMonitorConfig, updateMonitorGeneral, updateMonitorFollowRedirects, updateMonitorOtel, updateMonitorPublic, updateMonitorResponseTime, updateMonitorRetry, updateMonitorNotifiers, updateMonitorSchedulingRegions, updateMonitorTags, syncMonitorTags, triggerMonitorRun, runMonitorCheck, streamMonitorPreview, createPrivateLocation, updatePrivateLocation, deletePrivateLocation, setPrivateLocationStatus, acknowledgeMonitorIncident, resolveMonitorIncident, deleteMonitorIncident, freezeMonitorMonth, runImport (with `pages:write`, `incidents:write`, and `subscribers:write` when subscribers are included) |
| `pages:read` | listPages, getPage, getPageCustomDomain, assertCustomDomainInWorkspace, getSlugAvailable, listPageComponents, getPageComponentDailySummary, listPageComponentGroups, previewImport |
| `pages:write` | createPage, newPage, deletePage, updatePageGeneral, updatePageAppearance, updatePageConfiguration, updatePageCustomDomain, updatePageCustomTheme, updatePageLinks, updatePageLocales, updatePagePasswordProtection, createPageComponent, updatePageComponent, deletePageComponent, updatePageComponentOrder, createPageComponentGroup, updatePageComponentGroup, deletePageComponentGroup, runImport (with `monitors:write`, `incidents:write`, and `subscribers:write` when subscribers are included) |
| `incidents:read` | listStatusReports, getStatusReport, listIncidents, getIncident, getIncidentBySlackChannel, getIncidentForStatusReport, listLinkedStatusReportIds, listIncidentEvents, getIncidentEvent, getPostmortem, listMaintenances, getMaintenance, getMaintenanceUpdate |
| `incidents:write` | createStatusReport, updateStatusReport, deleteStatusReport, addStatusReportUpdate, updateStatusReportUpdate, deleteStatusReportUpdate, notifyStatusReport, declareIncident, updateIncident, setIncidentStatus, closeIncident, deleteIncident, addIncidentNote, linkIncidentStatusReport, unlinkIncidentStatusReport, bindIncidentSlackChannel, unbindIncidentSlackChannel, draftPostmortem, approvePostmortem, createMaintenance, updateMaintenance, deleteMaintenance, addMaintenanceUpdate, updateMaintenanceUpdate, deleteMaintenanceUpdate, notifyMaintenance |
| `notifications:read` | listNotifications, getNotification |
| `notifications:write` | createNotification, updateNotification, deleteNotification, sendTestNotification (RPC handler) |
| `subscribers:read` | listPageSubscribers, countPageSubscribers; `listAuditLogs` / `getAuditLog` hide `page_subscriber` rows without it |
| `subscribers:write` | createPageSubscriber, updatePageSubscriberChannel, unsubscribePageSubscriber, deletePageSubscriber, sendPageSubscriberTestWebhook |
| `admin` | createApiKey, revokeApiKey (except self-revoke), createInvitation, acceptInvitation, deleteInvitation, deleteMember, transferOwnership, enableSso, disableSso, joinSsoWorkspace, syncSsoDomain, removeSsoDomain, createSsoPortalLink, exchangeCode, revokeGrant, revokeGrantAsOwner, installSlackAgent, uninstallSlackAgent, deleteIntegration, createSlackUserMapping, updateWorkspaceName, updateWorkspacePlan, updateWorkspaceLimits, updateWorkspaceStripeId, markWorkspaceTrialed, previewWorkspaceDowngrade, downgradeWorkspaceToFree, deleteAccount |

Read verbs that take no `ctx` (status-page visitor paths, cron jobs, token
lookups) carry no scope by design; the lint rule
`openstatus/services-read-verbs-require-scope` covers the exported `list*`,
`get*`, `search*`, `stream*`, `preview*` verbs that do.

## Agent tools by scope

| Scope | Tools |
| --- | --- |
| `monitors:read` | list_monitors, get_monitor, get_monitor_status, get_monitor_summary, list_response_logs, get_response_log, list_private_locations |
| `monitors:write` | create_monitor, update_monitor |
| `pages:read` | list_status_pages, list_page_components |
| `pages:write` | create_status_page, update_status_page, add_page_component, update_page_component, create_component_group, update_component_group |
| `incidents:read` | list_status_reports, get_status_report, list_incidents, get_incident, get_postmortem, list_maintenances, get_maintenance |
| `incidents:write` | create_status_report, update_status_report, add_status_report_update, update_status_report_update, delete_status_report_update, resolve_status_report, declare_incident, update_incident, set_incident_status, resolve_incident, add_incident_note, draft_postmortem, approve_postmortem, create_maintenance, update_maintenance, add_maintenance_update, update_maintenance_update, delete_maintenance_update |
| `notifications:read` | list_notifications |
| `read` | list_audit_logs, get_audit_log |
| `any` | get_workspace, search_docs, get_doc_page, search_content, get_content_page |

No tool uses `notifications:write`, `subscribers:*` or `admin` on purpose:
channel secrets and subscriber emails stay out of transcripts, and admin is
never reachable by a credential.

## Adding a scope requirement

1. Pick the group from the table above. A new entity joins an existing
   group; a new group is a decision, not a default, and needs a row in
   `scopeGroups`, the presets, the V1 mounts, `RPC_SERVICE_GROUP`, the
   consent grid labels and this file.
2. Write verbs: `requireScope(ctx, "<group>:write")` first line. Read verbs:
   `requireScope(ctx, "<group>:read")`. Admin: `"admin"`.
3. Tools: `scope: "<group>:read" | "<group>:write"`, or `"any"` only for
   data that carries nothing workspace-sensitive.
4. Tests: a `rejects other-group key` case next to the entity's
   `rejects read-only actor` case.
