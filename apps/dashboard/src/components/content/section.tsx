import { cn } from "@/lib/utils";

export function Section({
  children,
  className,
  ...props
}: React.ComponentProps<"section">) {
  return (
    <section className={cn("space-y-4", className)} {...props}>
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
    <div className={cn("flex flex-col gap-1.5", className)} {...props}>
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
    <p className={cn("text-muted-foreground text-sm", className)} {...props}>
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
    <p className={cn("font-medium text-lg", className)} {...props}>
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
      className={cn("mx-auto w-full max-w-4xl space-y-8 px-4 py-8", className)}
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
    <div className={cn("space-y-1.5", className)} {...props}>
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
    <p className={cn("font-bold text-4xl", className)} {...props}>
      {children}
    </p>
  );
}
