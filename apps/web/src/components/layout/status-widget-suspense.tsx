import { Suspense } from "react";

import type { StatusWidgetProps } from "@openstatus/react";
import { StatusWidget } from "@openstatus/react";

export function StatusWidgetFallback() {
  return (
    <div className="border-border flex max-w-fit items-center gap-2 rounded-md border px-3 py-1 text-sm">
      <span className="bg-muted h-5 w-20 animate-pulse rounded-md" />
      <span className="bg-muted relative inline-flex h-2 w-2 rounded-full" />
    </div>
  );
}

export function StatusWidgetContainer(props: StatusWidgetProps) {
  return (
    <Suspense fallback={<StatusWidgetFallback />}>
      <StatusWidget {...props} />
    </Suspense>
  );
}
