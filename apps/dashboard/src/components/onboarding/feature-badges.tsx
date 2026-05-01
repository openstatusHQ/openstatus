"use client";

import { QuestionForm } from "@/components/forms/onboarding/question";
import { OnboardingResultHeading } from "@/components/layout/onboarding-layout";
import { cn } from "@/lib/utils";
import {
  BetterstackIcon,
  DiscordIcon,
  GitHubIcon,
  GrafanaIcon,
  InstatusIcon,
  ModelContextProtocolIcon,
  OpsGenieIcon,
  PagerDutyIcon,
  SlackIcon,
  StatuspageIcon,
  TelegramIcon,
  WhatsappIcon,
} from "@openstatus/icons";
import { Badge } from "@openstatus/ui/components/ui/badge";
import {
  Activity,
  ArrowUpRight,
  Bell,
  BookOpen,
  Braces,
  Building,
  Calendar,
  Cloud,
  Code,
  CreditCard,
  FileCode,
  FileText,
  Globe,
  Languages,
  LayoutGrid,
  ListTree,
  Lock,
  Mail,
  MessageSquare,
  Network,
  PartyPopper,
  Radar,
  ScanEye,
  ScrollText,
  Server,
  ServerCog,
  Shield,
  ShieldCheck,
  Smartphone,
  Sparkles,
  SquareTerminal,
  Tags,
  Terminal,
  UserPlus,
  Users,
  Webhook,
  Zap,
} from "lucide-react";
import Link from "next/link";

type FeatureBadgeItem = {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  external?: boolean;
};

const DOCS = "https://docs.openstatus.dev";
const WEB = "https://www.openstatus.dev";
const GITHUB = "https://github.com/openstatusHQ/openstatus";

const FEATURE_CATEGORIES: { label: string; items: FeatureBadgeItem[] }[] = [
  {
    label: "Monitoring",
    items: [
      { name: "HTTP monitor", href: "/monitors", icon: Activity },
      { name: "TCP monitor", href: "/monitors", icon: Network },
      { name: "DNS monitor", href: "/monitors", icon: Radar },
      {
        name: "Assertions",
        href: `${DOCS}/reference/http-monitor`,
        icon: FileCode,
        external: true,
      },
      {
        name: "OpenTelemetry",
        href: `${DOCS}/guides/how-to-export-metrics-to-otlp-endpoint`,
        icon: Zap,
        external: true,
      },
      {
        name: "Private locations",
        href: "/private-locations",
        icon: ServerCog,
      },
      { name: "Monitor tags", href: "/monitors", icon: Tags },
      { name: "Header analysis", href: "/monitors", icon: ListTree },
      {
        name: "GitHub Actions",
        href: `${DOCS}/guides/how-to-run-synthetic-test-github-action`,
        icon: ShieldCheck,
        external: true,
      },
      {
        name: "Cloudflare probes",
        href: `${DOCS}/guides/how-to-deploy-probes-cloudflare-containers`,
        icon: Cloud,
        external: true,
      },
    ],
  },
  {
    label: "Status page",
    items: [
      { name: "Custom domain", href: "/status-pages", icon: Globe },
      {
        name: "Themes",
        href: "https://themes.openstatus.dev",
        icon: Sparkles,
        external: true,
      },
      {
        name: "Components",
        href: `${DOCS}/reference/page-components`,
        icon: LayoutGrid,
        external: true,
      },
      { name: "Maintenances", href: "/status-pages", icon: Calendar },
      {
        name: "Incidents",
        href: `${DOCS}/reference/incident`,
        icon: PartyPopper,
        external: true,
      },
      {
        name: "Status reports",
        href: `${DOCS}/reference/status-report`,
        icon: FileCode,
        external: true,
      },
      {
        name: "Subscribers",
        href: `${DOCS}/reference/subscriber`,
        icon: Users,
        external: true,
      },
      { name: "Password protection", href: "/status-pages", icon: Lock },
      { name: "Email-domain access", href: "/status-pages", icon: Mail },
      { name: "IP allowlist", href: "/status-pages", icon: Shield },
      {
        name: "Multi-language",
        href: `${DOCS}/guides/how-to-translate-status-page`,
        icon: Languages,
        external: true,
      },
      {
        name: "Embed iframe",
        href: `${DOCS}/guides/how-to-embed-status-page-iframe`,
        icon: Code,
        external: true,
      },
      {
        name: "React widget",
        href: `${DOCS}/guides/how-to-use-react-widget`,
        icon: Code,
        external: true,
      },
      {
        name: "Status badges",
        href: `${DOCS}/guides/how-to-add-svg-status-badge`,
        icon: Tags,
        external: true,
      },
      {
        name: "Migrate from Statuspage",
        href: "/status-pages",
        icon: StatuspageIcon,
      },
      {
        name: "Migrate from Better Stack",
        href: "/status-pages",
        icon: BetterstackIcon,
      },
      {
        name: "Migrate from Instatus",
        href: "/status-pages",
        icon: InstatusIcon,
      },
    ],
  },
  {
    label: "Notifications",
    items: [
      { name: "Slack", href: "/notifications", icon: SlackIcon },
      { name: "Discord", href: "/notifications", icon: DiscordIcon },
      { name: "Email", href: "/notifications", icon: Mail },
      { name: "SMS", href: "/notifications", icon: Smartphone },
      { name: "WhatsApp", href: "/notifications", icon: WhatsappIcon },
      { name: "Telegram", href: "/notifications", icon: TelegramIcon },
      { name: "PagerDuty", href: "/notifications", icon: PagerDutyIcon },
      { name: "Opsgenie", href: "/notifications", icon: OpsGenieIcon },
      { name: "Grafana OnCall", href: "/notifications", icon: GrafanaIcon },
      { name: "Google Chat", href: "/notifications", icon: MessageSquare },
      { name: "ntfy", href: "/notifications", icon: Bell },
      { name: "Webhook", href: "/notifications", icon: Webhook },
    ],
  },
  {
    label: "Developer",
    items: [
      { name: "REST API", href: "/settings/api-keys", icon: Braces },
      {
        name: "Node SDK",
        href: `${DOCS}/sdk/nodejs`,
        icon: SquareTerminal,
        external: true,
      },
      { name: "CLI", href: "/cli", icon: Terminal },
      {
        name: "Terraform",
        href: `${DOCS}/reference/terraform`,
        icon: Server,
        external: true,
      },
      {
        name: "MCP server",
        href: "/agents",
        icon: ModelContextProtocolIcon,
      },
      { name: "Slack agent", href: "/agents", icon: SlackIcon },
      {
        name: "Self-hosting",
        href: `${DOCS}/guides/self-hosting-openstatus`,
        icon: Building,
        external: true,
      },
      {
        name: "GitHub",
        href: GITHUB,
        icon: GitHubIcon,
        external: true,
      },
    ],
  },
  {
    label: "Workspace",
    items: [
      { name: "Audit logs", href: "/audit-logs", icon: ScanEye },
      { name: "Billing & plans", href: "/settings/billing", icon: CreditCard },
      { name: "Team & invites", href: "/settings/general", icon: UserPlus },
    ],
  },
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
        <div className="flex flex-col gap-5">
          {FEATURE_CATEGORIES.map((category) => (
            <section key={category.label} className="flex flex-col gap-2">
              <p className="font-commit-mono text-muted-foreground text-xs uppercase tracking-wide">
                {category.label}
              </p>
              <div className="flex flex-wrap gap-2">
                {category.items.map((item) => (
                  <FeatureBadgePill key={item.name} item={item} />
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

function FeatureBadgePill({
  item,
  className,
  ...props
}: Omit<React.ComponentProps<typeof Link>, "href" | "children"> & {
  item: FeatureBadgeItem;
}) {
  const externalProps = item.external
    ? { target: "_blank" as const, rel: "noopener noreferrer" }
    : {};
  return (
    <Link
      className={cn("rounded-md", className)}
      href={item.href}
      {...externalProps}
      {...props}
    >
      <Badge
        variant="outline"
        className="group text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
      >
        <item.icon className="size-3" />
        {item.name}
        {item.external ? (
          <ArrowUpRight className="size-3 text-muted-foreground/70 group-hover:text-foreground" />
        ) : null}
      </Badge>
    </Link>
  );
}
