import { StatusCodeBadge } from "@/components/monitor/status-code-badge";
import type { Region } from "@openstatus/db/src/schema/constants";
import { latencyFormatter, regionFormatter, timestampFormatter } from "./utils";

export function RegionInfo({
  check,
  error,
}: {
  check: {
    region: Region;
    timestamp: number;
    latency: number;
    status?: number;
  };
  error?: string;
}) {
  return (
    <div className="grid grid-cols-5 gap-2 text-sm sm:grid-cols-9">
      <div className="col-span-2">
        <p className="text-muted-foreground">Time:</p>
      </div>
      <div className="col-span-3 sm:col-span-6">
        <p>{timestampFormatter(check.timestamp)}</p>
      </div>
      <div className="col-span-2">
        <p className="text-muted-foreground">Region:</p>
      </div>
      <div className="col-span-3 sm:col-span-6">
        <p>{regionFormatter(check.region)}</p>
      </div>
      <div className="col-span-2">
        <p className="text-muted-foreground">Latency:</p>
      </div>
      <div className="col-span-3 sm:col-span-6">
        <p>
          <code>{latencyFormatter(check.latency)}</code>
        </p>
      </div>
      {check.status ? (
        <>
          <div className="col-span-2">
            <p className="text-muted-foreground">Status:</p>
          </div>
          <div className="col-span-3 sm:col-span-6">
            <StatusCodeBadge statusCode={check.status} />
          </div>
        </>
      ) : null}
      {error ? (
        <>
          <div className="col-span-2">
            <p className="text-muted-foreground">Error:</p>
          </div>
          <div className="col-span-3 sm:col-span-6">
            <p className="font-medium text-destructive before:content-['«_'] after:content-['_»']">
              {error}
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}
