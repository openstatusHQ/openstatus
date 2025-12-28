import { TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type React from "react";

const TabsTriggerPill = ({
  children,
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsTrigger>) => {
  return (
    <TabsTrigger
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-full px-3 py-1 font-medium text-sm ring-offset-background transition-all hover:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </TabsTrigger>
  );
};

export default TabsTriggerPill;
