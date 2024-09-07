import { Badge } from "@openstatus/ui/src/components/badge";

import type { FeatureDescription } from "@/config/features";
import { cn } from "@/lib/utils";
import { Shell } from "../dashboard/shell";
import type { ValidIcon } from "../icons";
import { Icons } from "../icons";

export function CardContainer({ children }: { children: React.ReactNode }) {
  return (
    <Shell className="flex flex-col gap-6 bg-gradient-to-br from-0% from-[hsl(var(--muted))] to-20% to-transparent">
      {children}
    </Shell>
  );
}

export function CardHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3">
      {children}
    </div>
  );
}

export function CardIcon({ icon }: { icon: ValidIcon }) {
  const Icon = Icons[icon];
  return (
    <div className="rounded-full border border-border p-2">
      <Icon className="h-5 w-5" />
    </div>
  );
}

export function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="bg-gradient-to-tl from-0% from-[hsl(var(--muted))] to-40% to-[hsl(var(--foreground))] bg-clip-text text-center font-cal text-3xl text-transparent">
      {children}
    </h3>
  );
}

export function CardDescription({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("text-center text-muted-foreground", className)}>
      {children}
    </p>
  );
}

export function CardContent({
  children,
  dir = "cols",
}: {
  children: React.ReactNode;
  dir?: "rows" | "cols";
}) {
  return (
    <div
      className={cn("grid gap-10", {
        "grid-cols-none md:grid-cols-2": dir === "cols",
        "grid-rows-none md:grid-rows-2": dir === "rows",
      })}
    >
      {children}
    </div>
  );
}

export function CardFeatureContainer({
  children,
  dir = "rows",
}: {
  children: React.ReactNode;
  dir?: "rows" | "cols";
}) {
  return (
    <ul
      className={cn("gap-4 md:gap-6", {
        "grid md:grid-cols-3": dir === "cols",
        "flex flex-col": dir === "rows",
      })}
    >
      {children}
    </ul>
  );
}

// TODO: rename type a bit appropriately
export function CardFeature(props: FeatureDescription) {
  const FeatureIcon = Icons[props.icon];
  return (
    <li>
      <div className="grid gap-1">
        <p className="flex items-center gap-2">
          <FeatureIcon className="h-4 w-4 text-foreground/80" />
          <span className="font-medium text-foreground">
            {props.catchline.replace(".", "")}
          </span>{" "}
        </p>
        <span className="text-muted-foreground">{props.description}</span>
      </div>
      {props.badge ? (
        <Badge variant="secondary" className="-ml-2 mt-1">
          {props.badge}
        </Badge>
      ) : null}
    </li>
  );
}
