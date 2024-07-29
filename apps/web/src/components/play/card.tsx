import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@openstatus/ui/src/components/button";

import { Shell } from "@/components/dashboard/shell";
import { cn } from "@/lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  href: string;
  title: string;
  description: string;
  icon?: LucideIcon;
  variant?: "default" | "primary";
}

export function Card({
  title,
  description,
  href,
  variant = "default",
  icon,
  className,
  ...props
}: CardProps) {
  const buttonVariant = variant === "default" ? "outline" : "default";
  const shellClassName =
    variant === "default" ? "" : "bg-accent text-accent-foreground";

  const isExternal = href.startsWith("http");
  const externalProps = isExternal
    ? { target: "_blank", rel: "noreferrer" }
    : {};

  const Icon = icon;

  return (
    <Shell
      className={cn(
        "group flex flex-col gap-3 hover:shadow hover:dark:border-card-foreground/30",
        shellClassName,
        className,
      )}
      {...props}
    >
      <div className="flex-1 space-y-2">
        <h2 className={cn("font-cal text-xl")}>{title}</h2>
        <p className="text-muted-foreground">{description}</p>
      </div>
      <div className="flex items-center justify-between">
        <Button variant={buttonVariant} className="rounded-full" asChild>
          <Link href={href} {...externalProps}>
            Learn more
          </Link>
        </Button>
        <div className="group-hover:-rotate-12 rounded-full border border-border bg-background p-2 transition-transform duration-200">
          {Icon && <Icon className="h-5 w-5 text-muted-foreground" />}
        </div>
      </div>
    </Shell>
  );
}
