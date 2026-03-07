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
  getScheduledIncidents: (pageId: string) => Promise<StatuspageIncident[]>;
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

  return {
    getPages: () => request("/pages", z.array(StatuspagePageSchema)),
    getPage: (pageId) => request(`/pages/${pageId}`, StatuspagePageSchema),
    getComponents: (pageId) =>
      request(
        `/pages/${pageId}/components`,
        z.array(StatuspageComponentSchema),
      ),
    getComponentGroups: (pageId) =>
      request(
        `/pages/${pageId}/component-groups`,
        z.array(StatuspageGroupComponentSchema),
      ),
    getIncidents: (pageId) =>
      request(`/pages/${pageId}/incidents`, z.array(StatuspageIncidentSchema)),
    getScheduledIncidents: (pageId) =>
      request(
        `/pages/${pageId}/incidents/scheduled`,
        z.array(StatuspageIncidentSchema),
      ),
    getSubscribers: (pageId) =>
      request(
        `/pages/${pageId}/subscribers`,
        z.array(StatuspageSubscriberSchema),
      ),
  };
}
