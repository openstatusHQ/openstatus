import { z } from "zod";
import {
  type InstatusComponent,
  InstatusComponentSchema,
  type InstatusIncident,
  InstatusIncidentSchema,
  type InstatusMaintenance,
  InstatusMaintenanceSchema,
  type InstatusPage,
  InstatusPageSchema,
  type InstatusSubscriber,
  InstatusSubscriberSchema,
} from "./api-types";

export type InstatusClient = {
  getPages: () => Promise<InstatusPage[]>;
  getPage: (pageId: string) => Promise<InstatusPage>;
  getComponents: (pageId: string) => Promise<InstatusComponent[]>;
  getIncidents: (pageId: string) => Promise<InstatusIncident[]>;
  getMaintenances: (pageId: string) => Promise<InstatusMaintenance[]>;
  getSubscribers: (pageId: string) => Promise<InstatusSubscriber[]>;
};

export function createInstatusClient(
  apiKey: string,
  baseUrl = "https://api.instatus.com",
): InstatusClient {
  async function request<T>(path: string, schema: z.ZodType<T>): Promise<T> {
    const url = `${baseUrl}${path}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Instatus API error: ${response.status} ${response.statusText} for ${path}`,
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
    getPages: () => request("/v2/pages", z.array(InstatusPageSchema)),
    getPage: (pageId) => request(`/v2/${pageId}`, InstatusPageSchema),
    getComponents: (pageId) =>
      requestAllPages(`/v2/${pageId}/components`, InstatusComponentSchema),
    // Instatus only exposes incidents via v1 — there is no v2 equivalent.
    getIncidents: (pageId) =>
      requestAllPages(`/v1/${pageId}/incidents`, InstatusIncidentSchema),
    getMaintenances: (pageId) =>
      requestAllPages(`/v2/${pageId}/maintenances`, InstatusMaintenanceSchema),
    getSubscribers: (pageId) =>
      requestAllPages(`/v2/${pageId}/subscribers`, InstatusSubscriberSchema),
  };
}
