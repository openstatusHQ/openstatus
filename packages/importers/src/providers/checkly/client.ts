import type { z } from "zod";

import {
  type ChecklyCheck,
  ChecklyCheckSchema,
  type ChecklyIncident,
  ChecklyIncidentSchema,
  type ChecklyMaintenanceWindow,
  ChecklyMaintenanceWindowSchema,
  type ChecklyStatusPage,
  ChecklyStatusPageSchema,
  cursorResponse,
} from "./api-types";

export type ChecklyClient = {
  getChecks: () => Promise<ChecklyCheck[]>;
  getStatusPages: () => Promise<ChecklyStatusPage[]>;
  getIncidents: () => Promise<ChecklyIncident[]>;
  getMaintenanceWindows: () => Promise<ChecklyMaintenanceWindow[]>;
};

const PAGE_SIZE = 100;

/**
 * Checkly needs two auth headers: a bearer key AND the account id
 * (`X-Checkly-Account`). Missing/invalid either one returns 401.
 */
export function createChecklyClient(
  apiKey: string,
  accountId: string,
  baseUrl = "https://api.checklyhq.com",
): ChecklyClient {
  async function request<T>(path: string, schema: z.ZodType<T>): Promise<T> {
    const url = `${baseUrl}${path}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "X-Checkly-Account": accountId,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Checkly API error: ${response.status} ${response.statusText} for ${path}`,
      );
    }

    const data = await response.json();
    return schema.parse(data);
  }

  // Offset pagination (checks, maintenance-windows): bare array, `?limit&page`.
  async function pageAll<T extends z.ZodTypeAny>(
    path: string,
    itemSchema: T,
  ): Promise<z.infer<T>[]> {
    const all: z.infer<T>[] = [];
    const sep = path.includes("?") ? "&" : "?";
    let page = 1;

    while (true) {
      const items = await request(
        `${path}${sep}limit=${PAGE_SIZE}&page=${page}`,
        itemSchema.array(),
      );
      all.push(...items);
      // A short (or empty) page means we've reached the end.
      if (items.length < PAGE_SIZE) break;
      page++;
    }

    return all;
  }

  // Cursor pagination (status-pages, incidents): `{ entries, nextId }`.
  async function cursorAll<T extends z.ZodTypeAny>(
    path: string,
    itemSchema: T,
  ): Promise<z.infer<T>[]> {
    const all: z.infer<T>[] = [];
    const sep = path.includes("?") ? "&" : "?";
    const pageSchema = cursorResponse(itemSchema);
    let nextId: string | undefined;

    while (true) {
      const query = nextId
        ? `${sep}limit=${PAGE_SIZE}&nextId=${encodeURIComponent(nextId)}`
        : `${sep}limit=${PAGE_SIZE}`;
      const result: z.infer<typeof pageSchema> = await request(
        `${path}${query}`,
        pageSchema,
      );
      all.push(...result.entries);
      if (!result.nextId) break;
      nextId = result.nextId;
    }

    return all;
  }

  return {
    getChecks: () => pageAll("/v1/checks", ChecklyCheckSchema),
    getStatusPages: () =>
      cursorAll("/v1/status-pages", ChecklyStatusPageSchema),
    getIncidents: () =>
      cursorAll("/v1/status-pages/incidents", ChecklyIncidentSchema),
    getMaintenanceWindows: () =>
      pageAll("/v1/maintenance-windows", ChecklyMaintenanceWindowSchema),
  };
}
