import type {
  ImportConfig,
  ImportProvider,
  PhaseResult,
  ResourceResult,
} from "../../types";
import { createChecklyClient } from "./client";
import {
  mapCard,
  mapCheck,
  mapCheckType,
  mapIncidentToStatusReport,
  mapMaintenance,
  mapPage,
  mapService,
} from "./mapper";

export interface ChecklyImportConfig extends ImportConfig {
  // Optional at the type level (keeps `ImportProvider<ChecklyImportConfig>`
  // assignable to the base `ImportProvider`); `validate` rejects a missing id.
  checklyAccountId?: string;
  checklyStatusPageId?: string;
}

export function createChecklyProvider(): ImportProvider<ChecklyImportConfig> {
  return {
    name: "checkly",

    validate: async (config) => {
      if (!config.checklyAccountId) {
        return {
          valid: false,
          error:
            "Checkly account ID is required. Find it in Checkly → Account Settings → General.",
        };
      }
      try {
        const client = createChecklyClient(
          config.apiKey,
          config.checklyAccountId,
        );
        await client.getChecks();
        return { valid: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("401") || message.includes("403")) {
          return {
            valid: false,
            error:
              "Invalid Checkly API key or account ID. Create a key in Checkly → User Settings → API keys and copy your account ID from Account Settings.",
          };
        }
        return { valid: false, error: message };
      }
    },

    run: async (config) => {
      const startedAt = new Date();
      const client = createChecklyClient(
        config.apiKey,
        config.checklyAccountId ?? "",
      );
      const phases: PhaseResult[] = [];
      const errors: string[] = [];
      const pageId = config.pageId;

      // Phase 1: Checks → Monitors
      const checks = await client.getChecks();
      const monitorResources: ResourceResult[] = checks.map((check) => {
        const jobType = mapCheckType(check.checkType);
        if (!jobType) {
          return {
            sourceId: check.id,
            name: check.name,
            status: "skipped",
            error: `Checkly ${check.checkType} checks can't run as an OpenStatus HTTP-family monitor.`,
          };
        }
        const data = mapCheck(check, config.workspaceId);
        if (!data.url) {
          return {
            sourceId: check.id,
            name: check.name,
            status: "skipped",
            error: `No target URL on this ${check.checkType} check; skipped.`,
          };
        }
        return {
          sourceId: check.id,
          name: check.name,
          status: "created",
          data,
        };
      });
      phases.push({
        phase: "monitors",
        status: "completed",
        resources: monitorResources,
      });

      // Phase 2: Status Pages (first, or filtered by id)
      let statusPages = await client.getStatusPages();
      if (config.checklyStatusPageId) {
        statusPages = statusPages.filter(
          (p) => p.id === config.checklyStatusPageId,
        );
      }

      if (statusPages.length > 0) {
        const sp = statusPages[0];

        phases.push({
          phase: "page",
          status: "completed",
          resources: [
            {
              sourceId: sp.id,
              name: sp.name,
              status: "created",
              data: mapPage(sp, config.workspaceId),
            },
          ],
        });

        // Phase 3: Cards → Component Groups
        const groupResources: ResourceResult[] = sp.cards.map((card) => ({
          sourceId: card.id,
          name: card.name,
          status: "created",
          data: mapCard(card, config.workspaceId, pageId),
        }));
        phases.push({
          phase: "componentGroups",
          status: "completed",
          resources: groupResources,
        });

        // Phase 4: Services (per card) → Components (static)
        const componentResources: ResourceResult[] = [];
        let order = 0;
        for (const card of sp.cards) {
          for (const service of card.services) {
            componentResources.push({
              sourceId: service.id,
              name: service.name,
              status: "created",
              data: mapService(
                service,
                config.workspaceId,
                order++,
                card.id,
                pageId,
              ),
            });
          }
        }
        phases.push({
          phase: "components",
          status: "completed",
          resources: componentResources,
        });

        // Phase 5: Incidents → Status Reports
        // Incidents are account-wide; keep those touching this page's services
        // (plus service-less incidents, which can't be attributed elsewhere).
        const pageServiceIds = new Set(
          sp.cards.flatMap((c) => c.services.map((s) => s.id)),
        );
        const incidents = await client.getIncidents();
        const relevant = incidents.filter(
          (inc) =>
            inc.services.length === 0 ||
            inc.services.some((s) => pageServiceIds.has(s.id)),
        );
        const incidentResources: ResourceResult[] = relevant.map((inc) => ({
          sourceId: inc.id,
          name: inc.name,
          status: "created",
          data: mapIncidentToStatusReport(inc, config.workspaceId, pageId),
        }));
        phases.push({
          phase: "incidents",
          status: "completed",
          resources: incidentResources,
        });

        // Phase 6: Maintenance Windows → Maintenances
        const maintenanceWindows = await client.getMaintenanceWindows();
        const maintenanceResources: ResourceResult[] = maintenanceWindows.map(
          (mw) => ({
            sourceId: mw.id,
            name: mw.name,
            status: "created",
            data: mapMaintenance(mw, config.workspaceId, pageId),
          }),
        );
        phases.push({
          phase: "maintenances",
          status: "completed",
          resources: maintenanceResources,
        });
      }

      return {
        provider: "checkly",
        status: "completed",
        startedAt,
        completedAt: new Date(),
        phases,
        errors,
      };
    },
  };
}
