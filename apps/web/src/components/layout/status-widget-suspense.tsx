import { Suspense } from "react";

import type { StatusWidgetProps } from "@openstatus/react";
import { StatusWidget } from "@openstatus/react";

export function StatusWidgetFallback() {
  return (
    <div className="flex max-w-fit items-center gap-2 rounded-md border border-gray-200 px-3 py-1 text-sm text-gray-700 hover:bg-gray-100 hover:text-black">
      <span className="h-5 w-20 animate-pulse rounded-md bg-gray-600/10" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-black/10" />
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
