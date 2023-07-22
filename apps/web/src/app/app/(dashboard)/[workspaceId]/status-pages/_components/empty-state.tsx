import Link from "next/link";

import { Icons } from "@/components/icons";
import { Button } from "@/components/ui/button";

const PanelTopIcon = Icons["panel-top"];

export function EmptyState() {
  return (
    <div className="border-border bg-background col-span-full w-full rounded-lg border-dashed p-8">
      <div className="flex flex-col items-center justify-center gap-4">
        <div className="flex flex-col items-center justify-center gap-1">
          <PanelTopIcon className="h-6 w-6" />
          <p className="text-foreground text-base">No pages</p>
          <p className="text-muted-foreground">
            First create a monitor before creating a page.
          </p>
        </div>
        {/* Nice little example of how to */}
        <Button asChild>
          <Link href="./monitors">Go to monitors</Link>
        </Button>
      </div>
    </div>
  );
}
