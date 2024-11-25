"use client";

import {
  Separator,
  Tabs as ShadcnTabs,
  TabsContent as ShadcnTabsContent,
  TabsList as ShadcnTabsList,
  TabsTrigger as ShadcnTabsTrigger,
} from "@openstatus/ui";

import { cn } from "@/lib/utils";

export function TabsList({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof ShadcnTabsList> & {}) {
  return (
    // REMINDER: needed for sticky header - ideally, we remove the div
    <div className={className}>
      <ShadcnTabsList
        className={cn(
          "w-full justify-start overflow-x-auto overflow-y-hidden rounded-none bg-transparent p-0",
        )}
        {...props}
      />
      <Separator className="mb-6" />
    </div>
  );
}

export function TabsTrigger({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof ShadcnTabsTrigger>) {
  return (
    <ShadcnTabsTrigger
      className={cn(
        "relative rounded-none border-b-4 border-b-transparent bg-transparent px-4 pt-2 pb-3 text-muted-foreground shadow-none transition-none hover:text-primary data-[state=active]:border-b-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none",
        className,
      )}
      {...props}
    />
  );
}

export function Tabs(props: React.ComponentPropsWithoutRef<typeof ShadcnTabs>) {
  return <ShadcnTabs {...props} />;
}

export function TabsContent({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof ShadcnTabsContent>) {
  return <ShadcnTabsContent className={cn("w-full", className)} {...props} />;
}
