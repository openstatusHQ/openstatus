import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@openstatus/ui/components/ui/select";
import { cn } from "@openstatus/ui/lib/utils";

type Component = { id: number; name: string; groupId?: number | null };

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

/** Picker for `components` not yet on the list; `groups` adds section labels. */
export function ComponentListAdd({
  components,
  groups = [],
  onAdd,
  disabled = false,
  placeholder,
  className,
}: {
  components: Component[];
  groups?: { id: number; name: string }[];
  onAdd: (id: number) => void;
  disabled?: boolean;
  /** Replaces the "Add component" / "All components added" copy. */
  placeholder?: string;
  className?: string;
}) {
  const groupName = new Map(groups.map((g) => [g.id, g.name]));
  const byGroup = new Map<number | null, Component[]>();
  for (const c of components) {
    const key =
      c.groupId != null && groupName.has(c.groupId) ? c.groupId : null;
    byGroup.set(key, [...(byGroup.get(key) ?? []), c]);
  }

  return (
    <Select
      value=""
      disabled={disabled || components.length === 0}
      onValueChange={(value) => onAdd(Number(value))}
    >
      <ComponentListSelectTrigger
        aria-label="Add component"
        className={cn("text-muted-foreground", className)}
      >
        <SelectValue
          placeholder={
            placeholder ??
            (components.length ? "Add component" : "All components added")
          }
        />
      </ComponentListSelectTrigger>
      <SelectContent>
        {[...byGroup.entries()].map(([groupId, items]) => {
          const options = items.map((c) => (
            <SelectItem key={c.id} value={String(c.id)} className="font-mono">
              {c.name}
            </SelectItem>
          ));
          if (groupId === null) return options;
          return (
            <SelectGroup key={groupId}>
              <SelectLabel>{groupName.get(groupId)}</SelectLabel>
              {options}
            </SelectGroup>
          );
        })}
      </SelectContent>
    </Select>
  );
}
