import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Clock, FileCode, Gauge, Palette, PanelTop } from "lucide-react";

import { Button } from "@openstatus/ui";

import { Shell } from "@/components/dashboard/shell";
import { BackButton } from "@/components/layout/back-button";
import { cn } from "@/lib/utils";

export default async function PlayPage() {
  return (
    <>
      <BackButton href="/" />
      <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        {playgrounds.map((play, i) => {
          const isFirst = i === 0;
          return (
            <Card
              key={i}
              className={isFirst ? "sm:col-span-2" : undefined}
              {...play}
            />
          );
        })}
      </div>
    </>
  );
}

interface CardProps extends React.HTMLAttributes<HTMLDivElement>, Playground {}

function Card({
  label,
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
  const Icon = icon;

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
        <h2 className={cn("font-cal text-xl")}>{label}</h2>
        <p className="text-muted-foreground">{description}</p>
      </div>
      <div className="flex items-center justify-between">
        <Button variant={buttonVariant} className="rounded-full" asChild>
          <Link href={href} {...externalProps}>
            Learn more
          </Link>
        </Button>
        <div className="border-border bg-background rounded-full border p-2 transition-transform duration-200 group-hover:-rotate-12">
          <Icon className="text-muted-foreground h-5 w-5" />
        </div>
      </div>
    </Shell>
  );
}

type Playground = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  variant?: "default" | "primary";
};

const playgrounds: Playground[] = [
  {
    href: "/play/checker",
    label: "Speed Checker",
    description:
      "Get speed insights for your api, website from multiple regions. No account needed.",
    icon: Gauge,
    variant: "primary",
  },
  {
    href: "/play/status",
    label: "Status Page",
    description:
      "Get a status page for your website or api, supporting timezones.",
    icon: PanelTop,
  },
  {
    href: "https://astro.openstat.us",
    label: "Custom Astro Status Page",
    description:
      "Grab your API key and create a custom status page with our Astro starter.",
    icon: Palette,
  },
  {
    href: "https://time.openstatus.dev",
    label: "Shadcn UI Time Picker",
    description:
      "The missing time picker for your next project. Supports 12 hour and 24 hour formats. Fully accessible.",
    icon: Clock,
  },
  {
    href: "https://openstat.us",
    label: "All Status Codes",
    description:
      "Use the endpoint to return the desired error code for testing purposes.",
    icon: FileCode,
  },
];
