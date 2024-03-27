import {
  latencyFormatter,
  regionFormatter,
  timestampFormatter,
} from "../utils";
import type { RegionChecker } from "../utils";
import { StatusBadge } from "./status-badge";

export function RegionInfo({
  check,
  error,
}: {
  check: Pick<RegionChecker, "region" | "time" | "latency" | "status">;
  error?: string;
}) {
  return (
    <div className="grid grid-cols-5 gap-2 text-sm sm:grid-cols-9">
      <div className="col-span-2">
        <p className="text-muted-foreground">Time:</p>
      </div>
      <div className="col-span-3 sm:col-span-6">
        <p>{timestampFormatter(check.time)}</p>
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
      <div className="col-span-2">
        <p className="text-muted-foreground">Status:</p>
      </div>
      <div className="col-span-3 sm:col-span-6">
        <StatusBadge statusCode={check.status} />
      </div>
      {error ? (
        <>
          <div className="col-span-2">
            <p className="text-muted-foreground">Error:</p>
          </div>
          <div className="col-span-3 sm:col-span-6">
            <p className="text-destructive font-medium before:content-['«_'] after:content-['_»']">
              {error}
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}
