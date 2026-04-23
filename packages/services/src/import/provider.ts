import type { ImportProvider } from "@openstatus/importers";
import { createBetterstackProvider } from "@openstatus/importers/betterstack";
import { createInstatusProvider } from "@openstatus/importers/instatus";
import { createStatuspageProvider } from "@openstatus/importers/statuspage";

import type { ImportProviderName } from "./schemas";

/**
 * Factory for a specific provider adapter. Used by both preview and run.
 */
export function createProvider(name: ImportProviderName): ImportProvider {
  switch (name) {
    case "betterstack":
      return createBetterstackProvider();
    case "instatus":
      return createInstatusProvider();
    default:
      return createStatuspageProvider();
  }
}

export type ProviderConfig = {
  provider: ImportProviderName;
  apiKey: string;
  workspaceId: number;
  pageId?: number;
  statuspagePageId?: string;
  betterstackStatusPageId?: string;
  instatusPageId?: string;
};

/**
 * Strip the discriminator and reshape provider-specific ids so the
 * provider adapter receives exactly the fields it expects.
 */
export function buildProviderConfig(config: ProviderConfig) {
  const { provider, ...rest } = config;
  switch (provider) {
    case "betterstack":
      return {
        ...rest,
        betterstackStatusPageId: config.betterstackStatusPageId,
      };
    case "instatus":
      return { ...rest, instatusPageId: config.instatusPageId };
    default:
      return { ...rest, statuspagePageId: config.statuspagePageId };
  }
}
