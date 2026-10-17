import { cn } from "@/lib/utils";

export function EntityCard({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="entity-card"
      className={cn("flex flex-col text-sm", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function EntityCardHeader({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="entity-card-header"
      className={cn(
        "[&>svg]:text-muted-foreground flex min-w-0 items-start gap-2 px-3 py-2.5 [&>[data-slot=badge]]:shrink-0 [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function EntityCardTitle({
  children,
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="entity-card-title"
      className={cn(
        "line-clamp-2 min-w-0 flex-1 font-medium break-words",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export function EntityCardContent({
  children,
  className,
  ...props
}: React.ComponentProps<"dl">) {
  return (
    <dl
      data-slot="entity-card-content"
      className={cn(
        "grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 border-t px-3 py-2.5",
        className,
      )}
      {...props}
    >
      {children}
    </dl>
  );
}

export function EntityCardRow({
  label,
  children,
  className,
  ...props
}: React.ComponentProps<"dd"> & { label: string }) {
  return (
    <>
      <dt data-slot="entity-card-label" className="text-muted-foreground">
        {label}
      </dt>
      <dd
        data-slot="entity-card-row"
        className={cn("min-w-0 truncate text-right font-mono", className)}
        {...props}
      >
        {children}
      </dd>
    </>
  );
}
