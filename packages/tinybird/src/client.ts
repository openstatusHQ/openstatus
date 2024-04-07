import { Tinybird } from "@chronark/zod-bird";

import {
  tbBuildHomeStats,
  tbBuildMonitorList,
  tbBuildPublicStatus,
  tbIngestPingResponse,
  tbParameterHomeStats,
  tbParameterMonitorList,
  tbParameterPublicStatus,
} from "./validation";

// REMINDER:
const tb = new Tinybird({ token: process.env.TINY_BIRD_API_KEY! });

export const publishPingResponse = tb.buildIngestEndpoint({
  datasource: "ping_response__v6",
  event: tbIngestPingResponse,
});

/**
 * @deprecated but still used in server - please use OSTinybird.endpointStatusPeriod
 */
export function getMonitorList(tb: Tinybird) {
  return tb.buildPipe({
    pipe: "status_timezone__v1",
    parameters: tbParameterMonitorList,
    data: tbBuildMonitorList,
    opts: {
      // cache: "no-store",
      revalidate: 600, // 10 min cache
    },
  });
}

/**
 * Homepage stats used for our marketing page
 */
export function getHomeStats(tb: Tinybird) {
  return tb.buildPipe({
    pipe: "home_stats__v0",
    parameters: tbParameterHomeStats,
    data: tbBuildHomeStats,
    opts: {
      revalidate: 86400, // 60 * 60 * 24 = 86400s = 1d
    },
  });
}

export function getPublicStatus(tb: Tinybird) {
  return tb.buildPipe({
    pipe: "public_status__v0",
    parameters: tbParameterPublicStatus,
    data: tbBuildPublicStatus,
  });
}
