import { Tinybird } from "@chronark/zod-bird";

import {
  tbBuildHomeStats,
  tbBuildMonitorList,
  tbBuildResponseList,
  tbIngestPingResponse,
  tbParameterHomeStats,
  tbParameterMonitorList,
  tbParameterResponseList,
} from "./validation";

// REMINDER:
const tb = new Tinybird({ token: process.env.TINY_BIRD_API_KEY! });

export const publishPingResponse = tb.buildIngestEndpoint({
  datasource: "ping_response__v5",
  event: tbIngestPingResponse,
});

export function getResponseList(tb: Tinybird) {
  return tb.buildPipe({
    pipe: "response_list__v2",
    parameters: tbParameterResponseList,
    data: tbBuildResponseList,
    opts: {
      // cache: "no-store",
      revalidate: 30, // 30 seconds cache
    },
  });
}

export function getMonitorList(tb: Tinybird) {
  return tb.buildPipe({
    pipe: "status_timezone__v0",
    parameters: tbParameterMonitorList,
    data: tbBuildMonitorList,
    opts: {
      cache: "no-store",
      // revalidate: 30, // 30 seconds cache
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
    pipe: "status_timezone__v0",
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
