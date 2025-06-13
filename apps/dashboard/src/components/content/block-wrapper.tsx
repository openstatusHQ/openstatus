"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export function BlockWrapper({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const [isOpened, setIsOpened] = React.useState(false);

  return (
    <Collapsible open={isOpened} onOpenChange={setIsOpened}>
      <div className={cn("relative overflow-hidden", className)} {...props}>
        <CollapsibleContent
          forceMount
          className={cn("overflow-hidden", !isOpened && "max-h-48")}
        >
          {children}
        </CollapsibleContent>
        {!isOpened ? (
          <div
            className={cn(
              "absolute flex items-center justify-center bg-gradient-to-b from-transparent to-90% to-background p-2",
              isOpened ? "inset-x-0 bottom-0 h-12" : "inset-0"
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
