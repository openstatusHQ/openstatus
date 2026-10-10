import type { PageComponentImpact } from "@openstatus/db/src/schema/page_components/constants";
import { Add } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@openstatus/ui/components/ui/dropdown-menu";
import { SelectTrigger } from "@openstatus/ui/components/ui/select";
import { cn } from "@openstatus/ui/lib/utils";
import { Fragment } from "react";

import { StatusDot } from "@/components/common/status-dot";
import {
  type OrderedComponent,
  toComponentSections,
} from "@/data/page-components.client";
import { impactDisplay } from "@/data/status-report-updates.client";

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

/** `group` renders muted after the name for components in a group. */
export function ComponentListName({
  children,
  group,
  className,
  ...props
}: React.ComponentProps<"span"> & { group?: string | null }) {
  return (
    <span
      data-slot="component-list-name"
      className={cn("truncate font-mono", className)}
      {...props}
    >
      {children}
      {group ? (
        <span className="text-muted-foreground ml-1.5">{group}</span>
      ) : null}
    </span>
  );
}

/** Dot + label for an impact; nullish reads as untriaged. */
export function ComponentImpact({
  impact,
  className,
  ...props
}: React.ComponentProps<"span"> & {
  impact: PageComponentImpact | null | undefined;
}) {
  const display = impactDisplay(impact);
  return (
    <span
      data-slot="component-impact"
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 font-mono",
        className,
      )}
      {...props}
    >
      <StatusDot variant={display.variant} />
      {display.label}
    </span>
  );
}

/** Right-aligned controls on a row, like `DetailActions`. */
export function ComponentListActions({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="component-list-actions"
      className={cn("ml-auto flex shrink-0 items-center gap-1", className)}
      {...props}
    >
      {children}
    </div>
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

/**
 * Adds one of `components` not yet on the list, in page order: a group's
 * members sit under its label, runs of ungrouped components in between,
 * separated. Renders nothing once everything is added, unless a
 * `placeholder` explains the empty state.
 */
export function ComponentListAdd({
  components,
  groups = [],
  onAdd,
  disabled = false,
  placeholder,
  className,
}: {
  components: OrderedComponent[];
  groups?: { id: number; name: string }[];
  onAdd: (id: number) => void;
  disabled?: boolean;
  /** Shown as a disabled button when there is nothing to add. */
  placeholder?: string;
  className?: string;
}) {
  const sections = toComponentSections(components, groups);
  // -ml-2.5 puts the label on the names' edge
  const buttonClassName = cn(
    "text-muted-foreground -ml-2.5 h-7 self-start font-normal",
    className,
  );

  if (components.length === 0) {
    if (!placeholder) return null;
    return (
      <Button variant="ghost" size="sm" className={buttonClassName} disabled>
        <Add />
        {placeholder}
      </Button>
    );
  }

  const item = (c: OrderedComponent) => (
    <DropdownMenuItem
      key={c.id}
      className="font-mono"
      onSelect={() => onAdd(c.id)}
    >
      {c.name}
    </DropdownMenuItem>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={buttonClassName}
          disabled={disabled}
        >
          <Add />
          {placeholder ?? "Add component"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {sections.map((section, i) => {
          const key = section.group?.id ?? `ungrouped-${i}`;
          return (
            <Fragment key={key}>
              {i > 0 ? <DropdownMenuSeparator /> : null}
              {section.group ? (
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
                    {section.group.name}
                  </DropdownMenuLabel>
                  {section.items.map(item)}
                </DropdownMenuGroup>
              ) : (
                section.items.map(item)
              )}
            </Fragment>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
