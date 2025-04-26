import type { RegionChecker } from "@/components/ping-response-analysis/utils";
import { formatDuration } from "@/lib/utils";
import type { MonitorFlyRegion } from "@openstatus/db/src/schema/constants";

interface PingProps {
  url: string;
  region?: MonitorFlyRegion;
}

const JOB_TYPE = "http";
const ABORT_TIMEOUT = 7_000; // in ms

export async function pingEndpoint({ url, region }: PingProps) {
  try {
    const res = await fetch(`/api/checker/test/${JOB_TYPE}`, {
      method: "POST",
      headers: new Headers({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({ url, region, method: "GET" }),
      signal: AbortSignal.timeout(ABORT_TIMEOUT),
    });

    if (!res.ok) {
      return {
        error: "Something went wrong. Please try again.",
      };
    }

    const data = (await res.json()) as RegionChecker;

    // default assertion if no assertions are provided
    if (res.status < 200 || res.status >= 300) {
      return {
        data,
        error: `Assertion error: The response status was not 2XX: ${data.status}.`,
      };
    }

    return { data, error: undefined };
  } catch (error) {
    console.error(error);
    if (error instanceof Error && error.name === "AbortError") {
      return {
        error: `Abort error: request takes more then ${formatDuration(
          ABORT_TIMEOUT,
        )}.`,
      };
    }
    return {
      error: "Something went wrong. Please try again.",
    };
  }
}
