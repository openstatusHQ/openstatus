import type { z } from "zod";
import {
  type BetterstackIncident,
  BetterstackIncidentSchema,
  type BetterstackMonitor,
  type BetterstackMonitorGroup,
  BetterstackMonitorGroupSchema,
  BetterstackMonitorSchema,
  type BetterstackStatusPage,
  type BetterstackStatusPageResource,
  BetterstackStatusPageResourceSchema,
  BetterstackStatusPageSchema,
  type BetterstackStatusPageSection,
  BetterstackStatusPageSectionSchema,
  type BetterstackStatusReport,
  BetterstackStatusReportSchema,
  type BetterstackStatusUpdate,
  BetterstackStatusUpdateSchema,
  paginatedResponse,
} from "./api-types";

export type BetterstackClient = {
  getMonitors: () => Promise<BetterstackMonitor[]>;
  getMonitorGroups: () => Promise<BetterstackMonitorGroup[]>;
  getStatusPages: () => Promise<BetterstackStatusPage[]>;
  getStatusPageSections: (
    statusPageId: string,
  ) => Promise<BetterstackStatusPageSection[]>;
  getStatusPageResources: (
    statusPageId: string,
  ) => Promise<BetterstackStatusPageResource[]>;
  getStatusPageReports: (
    statusPageId: string,
  ) => Promise<BetterstackStatusReport[]>;
  getStatusReportUpdates: (
    statusPageId: string,
    reportId: string,
  ) => Promise<BetterstackStatusUpdate[]>;
  getIncidents: () => Promise<BetterstackIncident[]>;
};

export function createBetterstackClient(
  apiKey: string,
  baseUrl = "https://uptime.betterstack.com",
): BetterstackClient {
  async function request<T>(url: string, schema: z.ZodType<T>): Promise<T> {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const path = new URL(url).pathname;
      throw new Error(
        `BetterStack API error: ${response.status} ${response.statusText} for ${path}`,
      );
    }

    const data = await response.json();
    return schema.parse(data);
  }

  async function requestAllPages<T extends z.ZodTypeAny>(
    path: string,
    itemSchema: T,
  ): Promise<z.infer<T>[]> {
    const all: z.infer<T>[] = [];
    let url: string | null = `${baseUrl}${path}`;
    const pageSchema = paginatedResponse(itemSchema);

    while (url) {
      const result: z.infer<typeof pageSchema> = await request(url, pageSchema);
      all.push(...result.data);
      url = result.pagination.next;
    }

    return all;
  }

  return {
    getMonitors: () =>
      requestAllPages("/api/v2/monitors", BetterstackMonitorSchema),
    getMonitorGroups: () =>
      requestAllPages("/api/v2/monitor-groups", BetterstackMonitorGroupSchema),
    getStatusPages: () =>
      requestAllPages("/api/v2/status-pages", BetterstackStatusPageSchema),
    getStatusPageSections: (statusPageId) =>
      requestAllPages(
        `/api/v2/status-pages/${statusPageId}/sections`,
        BetterstackStatusPageSectionSchema,
      ),
    getStatusPageResources: (statusPageId) =>
      requestAllPages(
        `/api/v2/status-pages/${statusPageId}/resources`,
        BetterstackStatusPageResourceSchema,
      ),
    getStatusPageReports: (statusPageId) =>
      requestAllPages(
        `/api/v2/status-pages/${statusPageId}/status-reports`,
        BetterstackStatusReportSchema,
      ),
    getStatusReportUpdates: (statusPageId, reportId) =>
      requestAllPages(
        `/api/v2/status-pages/${statusPageId}/status-reports/${reportId}/status-updates`,
        BetterstackStatusUpdateSchema,
      ),
    getIncidents: () =>
      requestAllPages("/api/v3/incidents", BetterstackIncidentSchema),
  };
}
