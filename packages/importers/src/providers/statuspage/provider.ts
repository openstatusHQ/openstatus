import type {
  ImportConfig,
  ImportProvider,
  PhaseResult,
  ResourceResult,
} from "../../types";
import type { StatuspageIncident } from "./api-types";
import { createStatuspageClient } from "./client";
import {
  isScheduledIncident,
  mapComponent,
  mapComponentGroup,
  mapIncidentToMaintenance,
  mapIncidentToStatusReport,
  mapPage,
  mapSubscriber,
} from "./mapper";

export interface StatuspageImportConfig extends ImportConfig {
  statuspagePageId?: string;
}

export function createStatuspageProvider(): ImportProvider<StatuspageImportConfig> {
  return {
    name: "statuspage",

    validate: async (config) => {
      try {
        const client = createStatuspageClient(config.apiKey);
        await client.getPages();
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
      const client = createStatuspageClient(config.apiKey);
      const phases: PhaseResult[] = [];

      let pages = await client.getPages();
      if (config.statuspagePageId) {
        pages = pages.filter((p) => p.id === config.statuspagePageId);
      }

      let skippedSubscribers = 0;

      for (const page of pages) {
        const [components, groups, incidents, subscribers] = await Promise.all([
          client.getComponents(page.id),
          client.getComponentGroups(page.id),
          client.getIncidents(page.id),
          client.getSubscribers(page.id),
        ]);

        // Page phase
        const mappedPage = mapPage(page, config.workspaceId);
        phases.push({
          phase: "page",
          status: "completed",
          resources: [
            {
              sourceId: page.id,
              name: page.name,
              status: "created",
              data: mappedPage,
            },
          ],
        });

        const pageId = config.pageId;

        // Component groups phase
        const groupResources: ResourceResult[] = groups.map((g) => ({
          sourceId: g.id,
          name: g.name,
          status: "created" as const,
          data: mapComponentGroup(g, config.workspaceId, pageId),
        }));
        phases.push({
          phase: "componentGroups",
          status: "completed",
          resources: groupResources,
        });

        // Components phase
        const componentResources: ResourceResult[] = components.map((c) => ({
          sourceId: c.id,
          name: c.name,
          status: "created" as const,
          data: {
            ...mapComponent(c, config.workspaceId, pageId),
            sourceGroupId: c.group_id,
          },
        }));
        phases.push({
          phase: "components",
          status: "completed",
          resources: componentResources,
        });

        // Split incidents
        const realtimeIncidents: StatuspageIncident[] = [];
        const scheduledIncidents: StatuspageIncident[] = [];
        for (const inc of incidents) {
          if (isScheduledIncident(inc)) {
            scheduledIncidents.push(inc);
          } else {
            realtimeIncidents.push(inc);
          }
        }

        // Incidents phase (status reports)
        const incidentResources: ResourceResult[] = realtimeIncidents.map(
          (inc) => ({
            sourceId: inc.id,
            name: inc.name,
            status: "created" as const,
            data: mapIncidentToStatusReport(inc, config.workspaceId, pageId),
          }),
        );
        phases.push({
          phase: "incidents",
          status: "completed",
          resources: incidentResources,
        });

        // Maintenances phase
        const maintenanceResources: ResourceResult[] = scheduledIncidents.map(
          (inc) => ({
            sourceId: inc.id,
            name: inc.name,
            status: "created" as const,
            data: {
              ...mapIncidentToMaintenance(inc, config.workspaceId, pageId),
              sourceComponentIds: (inc.components ?? []).map((c) => c.id),
            },
          }),
        );
        phases.push({
          phase: "maintenances",
          status: "completed",
          resources: maintenanceResources,
        });

        // Subscribers phase
        const subscriberResources: ResourceResult[] = [];
        for (const sub of subscribers) {
          const mapped = mapSubscriber(sub, pageId);
          if (mapped) {
            subscriberResources.push({
              sourceId: sub.id,
              name: sub.email ?? sub.endpoint ?? sub.id,
              status: "created",
              data: mapped,
            });
          } else {
            skippedSubscribers++;
          }
        }
        phases.push({
          phase: "subscribers",
          status: "completed",
          resources: subscriberResources,
        });
      }

      const errors: string[] = [];
      if (skippedSubscribers > 0) {
        errors.push(
          `Only email subscribers are supported. ${skippedSubscribers} non-email subscriber${skippedSubscribers === 1 ? " was" : "s were"} skipped.`,
        );
      }

      return {
        provider: "statuspage",
        status: "completed",
        startedAt,
        completedAt: new Date(),
        phases,
        errors,
      };
    },
  };
}
