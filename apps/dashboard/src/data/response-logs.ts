import type { RouterOutputs } from "@openstatus/api";
import { flyRegions } from "@openstatus/db/src/schema/constants";
import { startOfDay } from "date-fns";

type ResponseLog = RouterOutputs["tinybird"]["list"]["data"][number];

const today = startOfDay(new Date());

export const exampleLogs: ResponseLog[] = Array.from({ length: 10 }).map(
  (_, i) => ({
    id: i.toString(),
    type: "http",
    url: "https://api.openstatus.dev",
    method: "GET",
    statusCode: 200,
    requestStatus: "success" as const,
    latency: 150,
    timing: {
      dns: 10,
      connect: 20,
      tls: 30,
      ttfb: 40,
      transfer: 50,
    },
    assertions: [],
    region: flyRegions[i],
    error: false,
    timestamp: today.getTime() + i * 1000 * 60,
    headers: {
      "Cache-Control":
        "private, no-cache, no-store, max-age=0, must-revalidate",
      "Content-Type": "text/html; charset=utf-8",
      Date: "Sun, 28 Jan 2024 08:50:13 GMT",
      Server: "Vercel",
    },
    workspaceId: "1",
    monitorId: "1",
    cronTimestamp: today.getTime() + i * 1000 * 60,
    trigger: "cron" as const satisfies "cron" | "api",
  })
);
