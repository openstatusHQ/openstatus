import type { Check } from "@openstatus/db/src/schema";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@openstatus/ui";
import { format } from "date-fns";
import { Minus } from "lucide-react";

export function RequestDetailsDialog({ check }: { check: Check }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="whitespace-nowrap">Request Details</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request Details</DialogTitle>
          <DialogDescription>Details of #{check.id}</DialogDescription>
        </DialogHeader>
        <dl className="grid gap-2">
          <div>
            <dt className="text-sm text-muted-foreground">URL</dt>
            <dd className="font-mono">{check.url}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Method</dt>
            <dd className="font-mono">{check.method}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Created At</dt>
            <dd className="font-mono">
              {!check.createdAt ? (
                <Minus className="h-4 w-4" />
              ) : (
                format(new Date(check.createdAt), "LLL dd, y HH:mm:ss")
              )}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Regions</dt>
            <dd className="font-mono">
              {check.regions.length ? (
                check.regions.join(", ")
              ) : (
                <Minus className="h-4 w-4" />
              )}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Headers</dt>
            <dd>
              {!check.headers ? (
                <Minus className="h-4 w-4" />
              ) : (
                <pre>{JSON.stringify(check.headers, null, 2)}</pre>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Body</dt>
            <dd>
              {!check.body ? (
                <Minus className="h-4 w-4" />
              ) : (
                <pre>{JSON.stringify(check.body, null, 2)}</pre>
              )}
            </dd>
          </div>
        </dl>
      </DialogContent>
    </Dialog>
  );
}
