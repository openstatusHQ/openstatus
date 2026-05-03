"use client";

import { QuestionForm } from "@/components/forms/onboarding/question";
import { OnboardingResultHeading } from "@/components/layout/onboarding-layout";
import { cn } from "@/lib/utils";
import { ModelContextProtocolIcon, SlackIcon } from "@openstatus/icons";
import {
  ArrowUpRight,
  Bell,
  BookOpen,
  Braces,
  FileText,
  Globe,
  Palette,
  ScanEye,
  ScrollText,
  ServerCog,
  Shield,
  Terminal,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";
import Link from "next/link";

type FeatureLinkItem = {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  external?: boolean;
};

const DOCS = "https://docs.openstatus.dev";
const WEB = "https://www.openstatus.dev";

const FEATURE_CATEGORIES: { label: string; items: FeatureLinkItem[] }[] = [
  {
    label: "Resources",
    items: [
      { name: "Docs", href: DOCS, icon: BookOpen, external: true },
      {
        name: "Changelog",
        href: `${WEB}/changelog`,
        icon: ScrollText,
        external: true,
      },
      {
        name: "Blog",
        href: `${WEB}/blog`,
        icon: FileText,
        external: true,
      },
    ],
  },
  {
    label: "Monitoring",
    items: [
      {
        name: "OpenTelemetry",
        href: `${DOCS}/guides/how-to-export-metrics-to-otlp-endpoint`,
        icon: Zap,
        external: true,
      },
      {
        name: "Private locations",
        href: `${DOCS}/tutorial/how-to-create-private-location`,
        icon: ServerCog,
        external: true,
      },
      {
        name: "Notifications",
        href: `${DOCS}/reference/notification`,
        icon: Bell,
        external: true,
      },
    ],
  },
  {
    label: "Status page",
    items: [
      {
        name: "Custom domain",
        href: `${DOCS}/reference/status-page#custom-domain`,
        icon: Globe,
        external: true,
      },
      {
        name: "Themes Store",
        href: "https://themes.openstatus.dev",
        icon: Palette,
        external: true,
      },
      {
        name: "Protection",
        href: `${DOCS}/reference/status-page#password-basic-auth`,
        icon: Shield,
        external: true,
      },
      {
        name: "Slack agent",
        href: `${DOCS}/tutorial/how-to-setup-slack-agent`,
        icon: SlackIcon,
        external: true,
      },
      {
        name: "Subscribers",
        href: `${DOCS}/reference/subscriber`,
        icon: Users,
        external: true,
      },
    ],
  },
  {
    label: "Developer",
    items: [
      {
        name: "REST API",
        href: `${DOCS}/api-reference`,
        icon: Braces,
        external: true,
      },
      {
        name: "CLI",
        href: `${DOCS}/reference/cli-reference`,
        icon: Terminal,
        external: true,
      },
      {
        name: "MCP server",
        href: `${DOCS}/reference/mcp-server`,
        icon: ModelContextProtocolIcon,
        external: true,
      },
    ],
  },
  {
    label: "Workspace",
    items: [
      { name: "Audit logs", href: "/audit-logs", icon: ScanEye },
      { name: "Team & invites", href: "/settings/general", icon: UserPlus },
    ],
  },
];

export function FeatureBadgeWall({
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "children">) {
  return (
    <div
      className={cn("flex flex-col gap-3 md:min-h-0 md:flex-1", className)}
      {...props}
    >
      <OnboardingResultHeading>
        What else openstatus can do
      </OnboardingResultHeading>
      <div className="rounded-md border border-border bg-background p-4 md:min-h-0 md:flex-1 md:overflow-y-auto">
        <div className="flex flex-col gap-4">
          {FEATURE_CATEGORIES.map((category) => (
            <section key={category.label} className="flex flex-col gap-2">
              <p className="font-commit-mono text-muted-foreground text-xs uppercase tracking-wide">
                {category.label}
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {category.items.map((item) => (
                  <FeatureLink key={item.name} item={item} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

export function QuestionPanel({
  onSubmit,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "children" | "onSubmit"> & {
  onSubmit: (values: { source: string; other?: string }) => Promise<void>;
}) {
  return (
    <div className={cn("flex flex-col gap-3", className)} {...props}>
      <OnboardingResultHeading>
        How did you hear about openstatus?
      </OnboardingResultHeading>
      <div className="rounded-md border border-border bg-background p-4">
        <QuestionForm onSubmit={onSubmit} />
      </div>
    </div>
  );
}

function FeatureLink({
  item,
  className,
  ...props
}: Omit<React.ComponentProps<typeof Link>, "href" | "children"> & {
  item: FeatureLinkItem;
}) {
  const externalProps = item.external
    ? { target: "_blank" as const, rel: "noopener noreferrer" }
    : {};
  return (
    <Link
      className={cn(
        "group inline-flex items-center gap-1.5 font-commit-mono text-muted-foreground text-sm transition-colors hover:text-foreground",
        className,
      )}
      href={item.href}
      {...externalProps}
      {...props}
    >
      <item.icon className="size-3" />
      <span>{item.name}</span>
      {item.external ? (
        <ArrowUpRight className="size-3 text-muted-foreground/70 group-hover:text-foreground" />
      ) : null}
    </Link>
  );
}
