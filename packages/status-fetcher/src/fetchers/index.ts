import type { StatusFetcher } from "../types";
import { AtlassianFetcher } from "./atlassian";
import { BetterStackFetcher } from "./betterstack";
import { CustomApiFetcher } from "./custom";
import { HtmlScraperFetcher } from "./html";
import { IncidentioFetcher } from "./incidentio";
import { InstatusFetcher } from "./instatus";
import { UptimeRobotFetcher } from "./uptimerobot";

export const fetchers: StatusFetcher[] = [
  new AtlassianFetcher(),
  new InstatusFetcher(),
  new BetterStackFetcher(),
  new IncidentioFetcher(),
  new UptimeRobotFetcher(),
  new CustomApiFetcher(),
  new HtmlScraperFetcher(),
];

export * from "./atlassian";
export * from "./instatus";
export * from "./betterstack";
export * from "./incidentio";
export * from "./uptimerobot";
export * from "./custom";
export * from "./html";
