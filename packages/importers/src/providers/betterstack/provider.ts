import type {
  ImportConfig,
  ImportProvider,
  PhaseResult,
  ResourceResult,
} from "../../types";
import { createBetterstackClient } from "./client";
import {
  mapIncidentToStatusReport,
  mapMonitor,
  mapMonitorGroup,
  mapReportToMaintenance,
  mapReportToStatusReport,
  mapResource,
  mapSection,
  mapStatusPage,
} from "./mapper";

export interface BetterstackImportConfig extends ImportConfig {
  betterstackStatusPageId?: string;
}

export function createBetterstackProvider(): ImportProvider<BetterstackImportConfig> {
  return {
    name: "betterstack",

    validate: async (config) => {
      try {
        const client = createBetterstackClient(config.apiKey);
        await client.getMonitors();
        return { valid: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("401")) {
          return {
            valid: false,
            error:
              "Invalid BetterStack API token. You can find your token in Better Stack → Settings → API tokens.",
          };
        }
        return { valid: false, error: message };
      }
    },

    run: async (config) => {
      const startedAt = new Date();
      const client = createBetterstackClient(config.apiKey);
      const phases: PhaseResult[] = [];
      const errors: string[] = [];

      // Phase 1: Monitors
      const monitors = await client.getMonitors();
      const monitorResources: ResourceResult[] = monitors.map((m) => ({
        sourceId: m.id,
        name: m.attributes.pronounceable_name,
        status: "created" as const,
        data: {
          ...mapMonitor(m, config.workspaceId),
          sourceMonitorGroupId: m.attributes.monitor_group_id,
        },
      }));
      phases.push({
        phase: "monitors",
        status: "completed",
        resources: monitorResources,
      });

      // Phase 2: Status Pages
      let statusPages = await client.getStatusPages();
      if (config.betterstackStatusPageId) {
        statusPages = statusPages.filter(
          (p) => p.id === config.betterstackStatusPageId,
        );
      }

      const pageId = config.pageId;

      if (statusPages.length > 0) {
        const sp = statusPages[0];
        const mappedPage = mapStatusPage(sp, config.workspaceId);
        phases.push({
          phase: "page",
          status: "completed",
          resources: [
            {
              sourceId: sp.id,
              name: sp.attributes.company_name,
              status: "created",
              data: mappedPage,
            },
          ],
        });

        // Phase 3: Status Page Sections → Component Groups
        const sections = await client.getStatusPageSections(sp.id);
        const sectionResources: ResourceResult[] = sections.map((s) => ({
          sourceId: s.id,
          name: s.attributes.name,
          status: "created" as const,
          data: mapSection(s, config.workspaceId, pageId),
        }));
        phases.push({
          phase: "sections",
          status: "completed",
          resources: sectionResources,
        });

        // Phase 5: Status Page Resources → Components
        const resources = await client.getStatusPageResources(sp.id);
        const componentResources: ResourceResult[] = resources.map((r) => ({
          sourceId: r.id,
          name: r.attributes.public_name,
          status: "created" as const,
          data: mapResource(r, config.workspaceId, pageId),
        }));
        phases.push({
          phase: "components",
          status: "completed",
          resources: componentResources,
        });

        // Phase 6 & 7: Status Page Reports → Incidents + Maintenances
        const reports = await client.getStatusPageReports(sp.id);
        const incidentResources: ResourceResult[] = [];
        const maintenanceResources: ResourceResult[] = [];

        for (const report of reports) {
          const updates = await client.getStatusReportUpdates(sp.id, report.id);

          if (report.attributes.report_type === "maintenance") {
            maintenanceResources.push({
              sourceId: report.id,
              name: report.attributes.title,
              status: "created",
              data: mapReportToMaintenance(
                report,
                updates,
                config.workspaceId,
                pageId,
              ),
            });
          } else {
            incidentResources.push({
              sourceId: report.id,
              name: report.attributes.title,
              status: "created",
              data: mapReportToStatusReport(
                report,
                updates,
                config.workspaceId,
                pageId,
              ),
            });
          }
        }

        phases.push({
          phase: "incidents",
          status: "completed",
          resources: incidentResources,
        });

        phases.push({
          phase: "maintenances",
          status: "completed",
          resources: maintenanceResources,
        });
      } else {
        // No status pages — still push monitor groups
        const monitorGroups = await client.getMonitorGroups();
        const groupResources: ResourceResult[] = monitorGroups.map((g) => ({
          sourceId: g.id,
          name: g.attributes.name,
          status: "created" as const,
          data: mapMonitorGroup(g, config.workspaceId, pageId),
        }));
        phases.push({
          phase: "monitorGroups",
          status: "completed",
          resources: groupResources,
        });

        // Fallback: use /v3/incidents for monitor-level incidents when no status page
        const incidents = await client.getIncidents();
        const incidentResources: ResourceResult[] = incidents.map((inc) => ({
          sourceId: inc.id,
          name: inc.attributes.name ?? `Incident ${inc.id}`,
          status: "created" as const,
          data: mapIncidentToStatusReport(inc, config.workspaceId, pageId),
        }));
        phases.push({
          phase: "incidents",
          status: "completed",
          resources: incidentResources,
        });
      }

      return {
        provider: "betterstack",
        status: "completed",
        startedAt,
        completedAt: new Date(),
        phases,
        errors,
      };
    },
  };
}
