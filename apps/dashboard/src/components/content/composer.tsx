"use client";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupTextarea,
} from "@openstatus/ui/components/ui/input-group";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@openstatus/ui/components/ui/tabs";
import { cn } from "@openstatus/ui/lib/utils";

import { ProcessMessage } from "@/components/content/process-message";

/** Markdown composer: write/preview tabs around a textarea, with a footer for actions. */
export function Composer({
  children,
  className,
  ...props
}: React.ComponentProps<typeof Tabs>) {
  return (
    <Tabs
      defaultValue="write"
      className={cn("min-w-0 flex-1", className)}
      {...props}
    >
      <InputGroup className="bg-background items-stretch overflow-hidden">
        {children}
      </InputGroup>
    </Tabs>
  );
}

export function ComposerHeader({
  children,
  className,
  ...props
}: React.ComponentProps<typeof InputGroupAddon>) {
  return (
    <InputGroupAddon
      align="block-start"
      className={cn(
        "justify-between border-b px-2 py-1.5 [.border-b]:pb-1.5",
        className,
      )}
      {...props}
    >
      {children}
    </InputGroupAddon>
  );
}

const tabsTriggerClassName =
  "text-muted-foreground hover:text-foreground data-[state=active]:text-foreground dark:data-[state=active]:bg-transparent h-7 flex-none data-[state=active]:bg-transparent data-[state=active]:shadow-none dark:data-[state=active]:border-transparent";

export function ComposerTabs({
  className,
  ...props
}: Omit<React.ComponentProps<typeof TabsList>, "children">) {
  return (
    <TabsList
      className={cn("h-auto rounded-none bg-transparent p-0", className)}
      {...props}
    >
      <TabsTrigger value="write" className={tabsTriggerClassName}>
        Write
      </TabsTrigger>
      <TabsTrigger value="preview" className={tabsTriggerClassName}>
        Preview
      </TabsTrigger>
    </TabsList>
  );
}

export function ComposerHint({
  children,
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="composer-hint"
      className={cn(
        "text-muted-foreground px-1 text-xs font-normal",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export function ComposerTextarea({
  className,
  ...props
}: React.ComponentProps<typeof InputGroupTextarea>) {
  return (
    <TabsContent value="write">
      <InputGroupTextarea className={cn("min-h-24", className)} {...props} />
    </TabsContent>
  );
}

export function ComposerPreview({
  value,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & { value: string }) {
  return (
    <TabsContent value="preview">
      <div
        data-slot="composer-preview"
        className={cn(
          "prose prose-sm dark:prose-invert min-h-24 max-w-none px-3 py-3",
          className,
        )}
        {...props}
      >
        {value.trim() ? (
          <ProcessMessage value={value} />
        ) : (
          <p className="text-muted-foreground">Nothing to preview.</p>
        )}
      </div>
    </TabsContent>
  );
}

export function ComposerFooter({
  children,
  className,
  ...props
}: React.ComponentProps<typeof InputGroupAddon>) {
  return (
    <InputGroupAddon
      align="block-end"
      className={cn(
        "bg-muted/50 flex-wrap justify-between border-t px-2 py-2 font-normal [.border-t]:pt-2",
        className,
      )}
      {...props}
    >
      {children}
    </InputGroupAddon>
  );
}
