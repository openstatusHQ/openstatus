import type { ImportProvider } from "@openstatus/importers";
import { createBetterstackProvider } from "@openstatus/importers/betterstack";
import { createInstatusProvider } from "@openstatus/importers/instatus";
import { createStatuspageProvider } from "@openstatus/importers/statuspage";

import type { ImportProviderName } from "./schemas";

/**
 * Factory for a specific provider adapter. Used by both preview and run.
 * Unknown names throw — silently defaulting would mask a typo'd provider
 * by running the Statuspage adapter against a non-Statuspage API key.
 */
export function createProvider(name: ImportProviderName): ImportProvider {
  switch (name) {
    case "betterstack":
      return createBetterstackProvider();
    case "instatus":
      return createInstatusProvider();
    case "statuspage":
      return createStatuspageProvider();
    default: {
      const exhaustive: never = name;
      throw new Error(`Unknown import provider: ${String(exhaustive)}`);
    }
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
 * provider adapter receives exactly the fields it expects. Mirrors
 * `createProvider`'s exhaustive-switch pattern — silently falling
 * through to Statuspage for a typo'd provider would pass the wrong
 * page id field and produce a confusing validation failure.
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
    case "statuspage":
      return { ...rest, statuspagePageId: config.statuspagePageId };
    default: {
      const exhaustive: never = provider;
      throw new Error(`Unknown import provider: ${String(exhaustive)}`);
    }
  }
}
