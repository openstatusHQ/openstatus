import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@openstatus/ui/components/ui/card";
import { cn } from "@openstatus/ui/lib/utils";

import { Badge } from "@openstatus/ui/components/ui/badge";
import { type VariantProps, cva } from "class-variance-authority";
import { Check } from "lucide-react";

export type StepCardVariant = NonNullable<
  VariantProps<typeof stepCardVariants>["variant"]
>;

const stepCardVariants = cva(
  "group relative w-full overflow-hidden py-0 gap-0 shadow-none",
  {
    variants: {
      variant: {
        active: "border-border bg-background",
        completed: "border-success/30 bg-success/5",
        upcoming: "border-border/50 bg-muted/30",
      },
    },
    defaultVariants: {
      variant: "active",
    },
  },
);

export function StepCard({
  children,
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof stepCardVariants>) {
  return (
    <Card
      data-variant={variant ?? "active"}
      className={cn(stepCardVariants({ variant }), className)}
      {...props}
    >
      {children}
    </Card>
  );
}

export function StepCardHeader({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <CardHeader
      data-slot="step-card-header"
      className={cn("flex flex-row items-center gap-3 px-4 py-3", className)}
      {...props}
    >
      {children}
    </CardHeader>
  );
}

export function StepCardIndicator({
  step,
  className,
  ...props
}: React.ComponentProps<"div"> & { step: number }) {
  return (
    <div
      data-slot="step-card-indicator"
      role="img"
      aria-label={`Step ${step}`}
      className={cn(
        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-medium text-xs",
        "group-data-[variant=completed]:bg-success group-data-[variant=completed]:text-white",
        "group-data-[variant=active]:border group-data-[variant=active]:border-foreground group-data-[variant=active]:bg-background group-data-[variant=active]:text-foreground",
        "group-data-[variant=upcoming]:border group-data-[variant=upcoming]:border-border group-data-[variant=upcoming]:bg-muted group-data-[variant=upcoming]:text-muted-foreground",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className="group-data-[variant=completed]:hidden"
      >
        {step}
      </span>
      <Check
        aria-hidden="true"
        className="hidden h-3 w-3 group-data-[variant=completed]:block"
      />
    </div>
  );
}

export function StepCardTitle({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <CardTitle
      data-slot="step-card-title"
      className={cn(
        "text-sm",
        "group-data-[variant=completed]:text-success",
        "group-data-[variant=upcoming]:text-muted-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </CardTitle>
  );
}

export function StepCardBadge({
  children,
  className,
  ...props
}: Omit<React.ComponentProps<typeof Badge>, "variant">) {
  return (
    <Badge
      data-slot="step-card-badge"
      variant="secondary"
      className={cn(
        "hidden group-data-[variant=completed]:inline-flex",
        "bg-success/10 text-success",
        className,
      )}
      {...props}
    >
      {children}
    </Badge>
  );
}

export function StepCardContent({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <CardContent
      data-slot="step-card-content"
      className={cn(
        "px-4 pb-4",
        "group-data-[variant=completed]:hidden",
        "group-data-[variant=upcoming]:select-none group-data-[variant=upcoming]:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </CardContent>
  );
}
