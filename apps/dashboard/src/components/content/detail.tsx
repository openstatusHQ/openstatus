import { cn } from "@openstatus/ui/lib/utils";
import { type VariantProps, cva } from "class-variance-authority";

export function DetailHeader({
  children,
  className,
  ...props
}: React.ComponentProps<"header">) {
  return (
    <header
      data-slot="detail-header"
      className={cn("flex flex-col gap-3 border-b pb-6", className)}
      {...props}
    >
      {children}
    </header>
  );
}

export function DetailEyebrow({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="detail-eyebrow"
      className={cn("flex min-h-8 flex-wrap items-center gap-2", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function DetailActions({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="detail-actions"
      className={cn("ml-auto flex items-center gap-2", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function DetailTitle({
  children,
  className,
  ...props
}: React.ComponentProps<"h1">) {
  return (
    <h1
      data-slot="detail-title"
      className={cn(
        "text-2xl font-semibold tracking-tight text-balance",
        className,
      )}
      {...props}
    >
      {children}
    </h1>
  );
}

export function DetailDescription({
  children,
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="detail-description"
      className={cn("text-muted-foreground text-pretty", className)}
      {...props}
    >
      {children}
    </p>
  );
}

export function DetailMeta({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="detail-meta"
      className={cn(
        "text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-sm",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function DetailMetaItem({
  children,
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="detail-meta-item"
      className={cn(
        "not-first:before:text-muted-foreground/50 inline-flex items-center gap-1.5 not-first:before:mr-0.5 not-first:before:content-['·']",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export function DetailContent({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="detail-content"
      className={cn(
        "grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,1fr)_22rem]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function DetailMain({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="detail-main"
      className={cn("flex min-w-0 flex-col gap-8", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function DetailAside({
  children,
  className,
  ...props
}: React.ComponentProps<"aside">) {
  return (
    <aside
      data-slot="detail-aside"
      className={cn("flex min-w-0 flex-col gap-8", className)}
      {...props}
    >
      {children}
    </aside>
  );
}

export function DetailSection({
  children,
  className,
  ...props
}: React.ComponentProps<"section">) {
  return (
    <section
      data-slot="detail-section"
      className={cn("flex flex-col gap-3", className)}
      {...props}
    >
      {children}
    </section>
  );
}

export function DetailSectionHeader({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="detail-section-header"
      className={cn("flex items-baseline justify-between gap-2", className)}
      {...props}
    >
      {children}
    </div>
  );
}

const detailSectionTitleVariants = cva("", {
  variants: {
    variant: {
      label:
        "text-muted-foreground text-xs font-medium tracking-wide uppercase",
      heading: "text-base font-medium",
    },
  },
  defaultVariants: {
    variant: "label",
  },
});

export function DetailSectionTitle({
  children,
  className,
  variant,
  ...props
}: React.ComponentProps<"h2"> &
  VariantProps<typeof detailSectionTitleVariants>) {
  return (
    <h2
      data-slot="detail-section-title"
      className={cn(detailSectionTitleVariants({ variant }), className)}
      {...props}
    >
      {children}
    </h2>
  );
}
