import { SelectTrigger } from "@openstatus/ui/components/ui/select";
import { cn } from "@openstatus/ui/lib/utils";

export function ComponentList({
  children,
  className,
  ...props
}: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="component-list"
      className={cn("flex flex-col gap-1 text-sm", className)}
      {...props}
    >
      {children}
    </ul>
  );
}

export function ComponentListItem({
  children,
  className,
  ...props
}: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="component-list-item"
      className={cn("group flex min-h-7 items-center gap-2", className)}
      {...props}
    >
      {children}
    </li>
  );
}

export function ComponentListName({
  children,
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="component-list-name"
      className={cn("truncate font-mono", className)}
      {...props}
    >
      {children}
    </span>
  );
}

export function ComponentListImpact({
  children,
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="component-list-impact"
      className={cn(
        "text-muted-foreground shrink-0 font-mono text-xs uppercase",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export function ComponentListEmpty({
  children = "No components affected.",
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="component-list-empty"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    >
      {children}
    </p>
  );
}

// Borderless until hovered, like PropertySelectTrigger.
export function ComponentListSelectTrigger({
  className,
  ...props
}: React.ComponentProps<typeof SelectTrigger>) {
  return (
    <SelectTrigger
      size="sm"
      className={cn(
        "hover:bg-accent dark:hover:bg-accent/50 data-[state=open]:bg-accent border-transparent bg-transparent shadow-none dark:bg-transparent",
        className,
      )}
      {...props}
    />
  );
}
