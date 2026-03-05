import { z } from "zod";
import {
  StatuspageComponentSchema,
  StatuspageGroupComponentSchema,
  StatuspageIncidentSchema,
  StatuspagePageSchema,
  StatuspageSubscriberSchema,
  type StatuspageComponent,
  type StatuspageGroupComponent,
  type StatuspageIncident,
  type StatuspagePage,
  type StatuspageSubscriber,
} from "./api-types";

export class StatuspageClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(apiKey: string, baseUrl = "https://api.statuspage.io/v1") {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  private async request<T>(path: string, schema: z.ZodType<T>): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `OAuth ${this.apiKey}`,
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

  async getPages(): Promise<StatuspagePage[]> {
    return this.request("/pages", z.array(StatuspagePageSchema));
  }

  async getPage(pageId: string): Promise<StatuspagePage> {
    return this.request(`/pages/${pageId}`, StatuspagePageSchema);
  }

  async getComponents(pageId: string): Promise<StatuspageComponent[]> {
    return this.request(
      `/pages/${pageId}/components`,
      z.array(StatuspageComponentSchema),
    );
  }

  async getComponentGroups(
    pageId: string,
  ): Promise<StatuspageGroupComponent[]> {
    return this.request(
      `/pages/${pageId}/component-groups`,
      z.array(StatuspageGroupComponentSchema),
    );
  }

  async getIncidents(pageId: string): Promise<StatuspageIncident[]> {
    return this.request(
      `/pages/${pageId}/incidents`,
      z.array(StatuspageIncidentSchema),
    );
  }

  async getScheduledIncidents(pageId: string): Promise<StatuspageIncident[]> {
    return this.request(
      `/pages/${pageId}/incidents/scheduled`,
      z.array(StatuspageIncidentSchema),
    );
  }

  async getSubscribers(pageId: string): Promise<StatuspageSubscriber[]> {
    return this.request(
      `/pages/${pageId}/subscribers`,
      z.array(StatuspageSubscriberSchema),
    );
  }
}
