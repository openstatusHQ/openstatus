import {
  latencyFormatter,
  regionFormatter,
  timestampFormatter,
} from "../utils";
import type { RegionChecker } from "../utils";
import { StatusBadge } from "./status-badge";

export function RegionInfo({ check }: { check: RegionChecker }) {
  return (
    <div className="grid grid-cols-4 gap-2 text-sm sm:grid-cols-6">
      <div className="col-span-1">
        <p className="text-muted-foreground">Date:</p>
      </div>
      <div className="col-span-3 sm:col-span-5">
        <p className="font-light">{timestampFormatter(check.time)}</p>
      </div>
      <div className="col-span-1">
        <p className="text-muted-foreground">Region:</p>
      </div>
      <div className="col-span-3 sm:col-span-5">
        <p>{regionFormatter(check.region)}</p>
      </div>
      <div className="col-span-1">
        <p className="text-muted-foreground">Latency:</p>
      </div>
      <div className="col-span-3 sm:col-span-5">
        <p>
          <code>{latencyFormatter(check.latency)}</code>
        </p>
      </div>
      <div className="col-span-1">
        <p className="text-muted-foreground">Status:</p>
      </div>
      <div className="col-span-3 sm:col-span-5">
        <StatusBadge statusCode={check.status} />
      </div>
    </div>
  );
}
