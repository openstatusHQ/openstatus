import { ArrowUpRight } from "@openstatus/icons";
import { Input } from "@openstatus/ui/components/ui/input";
import { SelectTrigger } from "@openstatus/ui/components/ui/select";
import { cn } from "@openstatus/ui/lib/utils";

import { DateTimePicker } from "@/components/common/date-time-picker";
import { Link } from "@/components/common/link";

export function PropertyList({
  children,
  className,
  ...props
}: React.ComponentProps<"dl">) {
  return (
    <dl
      data-slot="property-list"
      className={cn("flex flex-col gap-1", className)}
      {...props}
    >
      {children}
    </dl>
  );
}

export function Property({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="property"
      className={cn(
        "grid grid-cols-[6rem_minmax(0,1fr)] items-start gap-x-3 text-sm",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function PropertyLabel({
  children,
  className,
  ...props
}: React.ComponentProps<"dt">) {
  return (
    <dt
      data-slot="property-label"
      className={cn("text-muted-foreground truncate leading-8", className)}
      {...props}
    >
      {children}
    </dt>
  );
}

export function PropertyValue({
  children,
  className,
  ...props
}: React.ComponentProps<"dd">) {
  return (
    <dd
      data-slot="property-value"
      className={cn(
        "flex min-h-8 min-w-0 items-center gap-2 font-mono",
        className,
      )}
      {...props}
    >
      {children}
    </dd>
  );
}

// pr-2 lines the arrow up with select chevrons on sibling rows.
export function PropertyLink({
  children,
  className,
  ...props
}: React.ComponentProps<typeof Link>) {
  return (
    <Link
      data-slot="property-link"
      className={cn(
        "group flex min-w-0 flex-1 items-center justify-between gap-2 pr-2 font-normal",
        className,
      )}
      {...props}
    >
      <span className="truncate">{children}</span>
      <ArrowUpRight className="text-muted-foreground group-hover:text-foreground size-4 shrink-0 transition-colors" />
    </Link>
  );
}

// Borderless until hovered; -ml-2 keeps the control's text on the value column's edge.
const propertyControlClassName =
  "hover:bg-accent dark:hover:bg-accent/50 -ml-2 h-8 w-[calc(100%+0.5rem)] min-w-0 border-transparent bg-transparent px-2 shadow-none dark:bg-transparent";

export function PropertySelectTrigger({
  children,
  className,
  ...props
}: React.ComponentProps<typeof SelectTrigger>) {
  return (
    <SelectTrigger
      size="sm"
      className={cn(
        propertyControlClassName,
        "data-[state=open]:bg-accent",
        className,
      )}
      {...props}
    >
      {children}
    </SelectTrigger>
  );
}

// The native date picker icon is pinned right to line up with select chevrons.
export function PropertyInput({
  className,
  ...props
}: React.ComponentProps<typeof Input>) {
  return (
    <Input
      className={cn(
        propertyControlClassName,
        "relative md:text-sm [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-2 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export function PropertyDateTimePicker({
  className,
  ...props
}: React.ComponentProps<typeof DateTimePicker>) {
  return (
    <DateTimePicker
      className={cn(
        propertyControlClassName,
        // the outline variant re-adds a border and tint in dark mode
        "data-[state=open]:bg-accent dark:hover:bg-accent/50 md:text-sm dark:border-transparent",
        className,
      )}
      {...props}
    />
  );
}
