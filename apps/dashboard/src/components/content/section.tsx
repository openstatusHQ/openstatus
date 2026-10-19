import { cn } from "@/lib/utils";

export function Section({
  children,
  className,
  ...props
}: React.ComponentProps<"section">) {
  return (
    <section
      data-slot="section"
      className={cn("space-y-4", className)}
      {...props}
    >
      {children}
    </section>
  );
}

export function SectionHeader({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="section-header"
      className={cn("flex min-w-0 flex-col gap-1.5", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function SectionHeaderRow({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="section-header-row"
      className={cn(
        "flex flex-col gap-1.5 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function SectionDescription({
  children,
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="section-description"
      className={cn(
        "font-commit-mono text-muted-foreground text-sm tracking-tight",
        className,
      )}
      {...props}
    >
      {children}
    </p>
  );
}

export function SectionTitle({
  children,
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="section-title"
      className={cn("text-lg font-medium", className)}
      {...props}
    >
      {children}
    </p>
  );
}

export function SectionGroup({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="section-group"
      className={cn("mx-auto w-full max-w-6xl space-y-8 px-4 py-8", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function SectionGroupHeader({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="section-group-header"
      className={cn("space-y-1.5", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function SectionGroupTitle({
  children,
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="section-group-title"
      className={cn("text-4xl font-bold", className)}
      {...props}
    >
      {children}
    </p>
  );
}
