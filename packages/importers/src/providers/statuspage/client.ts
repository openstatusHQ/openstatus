import { z } from "zod";
import {
  type StatuspageComponent,
  StatuspageComponentSchema,
  type StatuspageGroupComponent,
  StatuspageGroupComponentSchema,
  type StatuspageIncident,
  StatuspageIncidentSchema,
  type StatuspagePage,
  StatuspagePageSchema,
  type StatuspageSubscriber,
  StatuspageSubscriberSchema,
} from "./api-types";

export type StatuspageClient = {
  getPages: () => Promise<StatuspagePage[]>;
  getPage: (pageId: string) => Promise<StatuspagePage>;
  getComponents: (pageId: string) => Promise<StatuspageComponent[]>;
  getComponentGroups: (pageId: string) => Promise<StatuspageGroupComponent[]>;
  getIncidents: (pageId: string) => Promise<StatuspageIncident[]>;
  // NOTE: could add getScheduledStatusReports if we need the dedicated /incidents/scheduled endpoint
  getSubscribers: (pageId: string) => Promise<StatuspageSubscriber[]>;
};

export function createStatuspageClient(
  apiKey: string,
  baseUrl = "https://api.statuspage.io/v1",
): StatuspageClient {
  async function request<T>(path: string, schema: z.ZodType<T>): Promise<T> {
    const url = `${baseUrl}${path}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `OAuth ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Statuspage API error: ${response.status} ${response.statusText} for ${path}`,
      );
    }

    const data = await response.json();
    return schema.parse(data);
  }

  async function requestAllPages<T>(
    path: string,
    itemSchema: z.ZodType<T>,
    perPage = 100,
  ): Promise<T[]> {
    const all: T[] = [];
    let page = 1;
    while (true) {
      const separator = path.includes("?") ? "&" : "?";
      const items = await request(
        `${path}${separator}page=${page}&per_page=${perPage}`,
        z.array(itemSchema),
      );
      all.push(...items);
      if (items.length < perPage) break;
      page++;
    }
    return all;
  }

  return {
    getPages: () => request("/pages", z.array(StatuspagePageSchema)),
    getPage: (pageId) => request(`/pages/${pageId}`, StatuspagePageSchema),
    getComponents: (pageId) =>
      requestAllPages(`/pages/${pageId}/components`, StatuspageComponentSchema),
    getComponentGroups: (pageId) =>
      requestAllPages(
        `/pages/${pageId}/component-groups`,
        StatuspageGroupComponentSchema,
      ),
    getIncidents: (pageId) =>
      requestAllPages(`/pages/${pageId}/incidents`, StatuspageIncidentSchema),
    getSubscribers: (pageId) =>
      requestAllPages(
        `/pages/${pageId}/subscribers`,
        StatuspageSubscriberSchema,
      ),
  };
}
