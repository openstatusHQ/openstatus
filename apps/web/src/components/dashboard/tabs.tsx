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
}: React.ComponentPropsWithoutRef<typeof ShadcnTabsList>) {
  return (
    <>
      <ShadcnTabsList
        className={cn(
          "w-full justify-start rounded-none bg-transparent p-0",
          className,
        )}
        {...props}
      />
      <Separator className="mb-6" />
    </>
  );
}

export function TabsTrigger({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof ShadcnTabsTrigger>) {
  return (
    <ShadcnTabsTrigger
      className={cn(
        "text-muted-foreground hover:text-primary data-[state=active]:border-b-primary data-[state=active]:text-foreground relative rounded-none border-b-2 border-b-transparent bg-transparent px-4 pb-3 pt-2 shadow-none transition-none data-[state=active]:shadow-none",
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
