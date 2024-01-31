import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { Button } from "@openstatus/ui";

import { Shell } from "@/components/dashboard/shell";
import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  href: string;
  title: string;
  description: string;
  icon?: LucideIcon;
  variant?: "default" | "primary";
}

// TODO: unify the cards of playground, oss-friends and external monitors

function Card({
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

  return (
    <Shell
      className={cn(
        "group flex flex-col gap-3 hover:shadow",
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
        <div className="border-border bg-background rounded-full border p-2 transition-transform duration-200 group-hover:-rotate-12">
          {icon ? icon({ className: "text-muted-foreground h-5 w-5" }) : null}
        </div>
      </div>
    </Shell>
  );
}
