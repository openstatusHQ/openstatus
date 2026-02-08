"use client";

import * as React from "react";

import { Button } from "@openstatus/ui/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@openstatus/ui/components/ui/collapsible";
import { cn } from "@openstatus/ui/lib/utils";

export function BlockWrapper({
  className,
  children,
  autoOpen,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  autoOpen?: boolean;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [isOpened, setIsOpened] = React.useState(false);

  React.useEffect(() => {
    if (ref.current && autoOpen) {
      const height = ref.current.scrollHeight;
      // NOTE: max-h-48 in tw equals 192px (48 * 4px)
      if (height <= 192) {
        setIsOpened(true);
      }
    }
  }, [autoOpen]);

  return (
    <Collapsible open={isOpened} onOpenChange={setIsOpened}>
      <div className={cn("relative overflow-hidden", className)} {...props}>
        <CollapsibleContent
          forceMount
          ref={ref}
          className={cn("overflow-hidden", !isOpened && "max-h-48")}
        >
          {children}
        </CollapsibleContent>
        {!isOpened ? (
          <div
            className={cn(
              "absolute flex items-center justify-center bg-gradient-to-b from-transparent to-90% to-background p-2",
              isOpened ? "inset-x-0 bottom-0 h-12" : "inset-0",
            )}
          >
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm">
                Expand
              </Button>
            </CollapsibleTrigger>
          </div>
        ) : null}
      </div>
    </Collapsible>
  );
}
