import { emptyAnalytics, jitsuAnalytics } from "@jitsu/js";

import { env } from "../env";
import type { AnalyticsEvents } from "./type";

export const analytics =
  env.JITSU_HOST && env.JITSU_WRITE_KEY
    ? jitsuAnalytics({
        host: env.JITSU_HOST,
        writeKey: env.JITSU_WRITE_KEY,
      })
    : emptyAnalytics;

export const trackAnalytics = (args: AnalyticsEvents) => analytics.track(args);
