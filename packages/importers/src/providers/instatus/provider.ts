import type {
  ImportConfig,
  ImportProvider,
  PhaseResult,
  ResourceResult,
} from "../../types";
import { createInstatusClient } from "./client";
import {
  mapComponent,
  mapComponentGroup,
  mapIncidentToStatusReport,
  mapMaintenanceToMaintenance,
  mapPage,
  mapSubscriber,
  partitionComponents,
} from "./mapper";

export interface InstatusImportConfig extends ImportConfig {
  instatusPageId?: string;
}

export function createInstatusProvider(): ImportProvider<InstatusImportConfig> {
  return {
    name: "instatus",

    validate: async (config) => {
      try {
        const client = createInstatusClient(config.apiKey);
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
      const client = createInstatusClient(config.apiKey);
      const phases: PhaseResult[] = [];

      let pages = await client.getPages();
      if (config.instatusPageId) {
        pages = pages.filter((p) => p.id === config.instatusPageId);
      }

      let skippedSubscribers = 0;

      for (const pg of pages) {
        const [allComponents, incidents, maintenances, subscribers] =
          await Promise.all([
            client.getComponents(pg.id),
            client.getIncidents(pg.id),
            client.getMaintenances(pg.id),
            client.getSubscribers(pg.id),
          ]);

        const { groups, components } = partitionComponents(allComponents);

        // Page phase
        const mappedPage = mapPage(pg, config.workspaceId);
        phases.push({
          phase: "page",
          status: "completed",
          resources: [
            {
              sourceId: pg.id,
              name: pg.name,
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
            sourceGroupId: c.group,
          },
        }));
        phases.push({
          phase: "components",
          status: "completed",
          resources: componentResources,
        });

        // Incidents phase (status reports)
        const incidentResources: ResourceResult[] = incidents.map((inc) => ({
          sourceId: inc.id,
          name: inc.name,
          status: "created" as const,
          data: mapIncidentToStatusReport(inc, config.workspaceId, pageId),
        }));
        phases.push({
          phase: "incidents",
          status: "completed",
          resources: incidentResources,
        });

        // Maintenances phase
        const maintenanceResources: ResourceResult[] = maintenances.map(
          (m) => ({
            sourceId: m.id,
            name: m.name,
            status: "created" as const,
            data: {
              ...mapMaintenanceToMaintenance(m, config.workspaceId, pageId),
              sourceComponentIds: m.components ?? [],
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
              name: sub.email ?? sub.id,
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
        provider: "instatus",
        status: "completed",
        startedAt,
        completedAt: new Date(),
        phases,
        errors,
      };
    },
  };
}
