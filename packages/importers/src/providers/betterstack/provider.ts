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
        return {
          valid: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },

    run: async (config) => {
      const startedAt = new Date();
      const client = createBetterstackClient(config.apiKey);
      const phases: PhaseResult[] = [];

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

        // Status Page Sections → Components
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
      }

      // Monitor Groups → Component Groups (always fetched regardless of status pages)
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

      // Phase 5: Incidents → Status Reports
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

      return {
        provider: "betterstack",
        status: "completed",
        startedAt,
        completedAt: new Date(),
        phases,
        errors: [],
      };
    },
  };
}
