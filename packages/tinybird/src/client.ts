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
 * That pipe is used in the homepage to show the status while having cached data
 * FYI We had 3TB of processed data during August. We will be able to reduce it signifcantly.
 * The cache is only applied on the homepage.
 */
export function getHomeMonitorList(tb: Tinybird) {
  return tb.buildPipe({
    pipe: "status_timezone__v1",
    parameters: tbParameterMonitorList,
    data: tbBuildMonitorList,
    opts: {
      revalidate: 600, // 10 minutes cache
    },
  });
}

/**
 * Homepage stats used for our marketing page.
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
