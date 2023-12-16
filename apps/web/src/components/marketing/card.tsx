import { Badge } from "@openstatus/ui";

import type { FeatureDescription } from "@/config/features";
import { cn } from "@/lib/utils";
import { Shell } from "../dashboard/shell";
import type { ValidIcon } from "../icons";
import { Icons } from "../icons";

export function CardContainer({ children }: { children: React.ReactNode }) {
  return (
    <Shell className="grid gap-6 bg-gradient-to-br from-[hsl(var(--muted))] from-0% to-transparent to-20%">
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
    <div className="border-border rounded-full border p-2">
      <Icon className="h-5 w-5" />
    </div>
  );
}

export function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-cal bg-gradient-to-tl from-[hsl(var(--muted))] from-0% to-[hsl(var(--foreground))] to-50% bg-clip-text text-center text-3xl text-transparent">
      {children}
    </h3>
  );
}

export function CardDescription({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground mt-2">{children}</p>;
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
        "grid-cols-1 md:grid-cols-2": dir === "cols",
        "grid-rows-2": dir === "rows",
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
      className={cn("grid gap-4 md:gap-6", {
        "md:grid-cols-3": dir === "cols",
        "md:grid-rows-3": dir === "rows",
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
      <p className="flex flex-col">
        <span>
          <FeatureIcon className="text-foreground/80 mb-1 mr-1.5 inline-flex h-4 w-4" />
          <span className="text-foreground font-medium">
            {props.catchline.replace(".", "")}
          </span>{" "}
        </span>
        <span className="text-muted-foreground">{props.description}</span>
      </p>
      {props.badge ? (
        <Badge variant="secondary" className="-ml-2 mt-1">
          {props.badge}
        </Badge>
      ) : null}
    </li>
  );
}
