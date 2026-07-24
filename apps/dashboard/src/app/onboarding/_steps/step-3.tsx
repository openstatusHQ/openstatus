"use client";

import {
  ApiKey,
  Monitor,
  Next,
  Notification,
  Calendar,
  Billing,
  Overview,
  StatusPage,
  Invite,
} from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo } from "react";

import { Code } from "@/components/common/code";
import { Link as CommonLink } from "@/components/common/link";
import { CreateApiKeyDialog } from "@/components/forms/api-key/dialog";
import {
  FormCard,
  FormCardContent,
  FormCardDescription,
  FormCardFooter,
  FormCardFooterInfo,
  FormCardHeader,
  FormCardTitle,
} from "@/components/forms/form-card";
import {
  OnboardingActions,
  OnboardingFormColumn,
  OnboardingResultColumn,
  type OnboardingStep,
  OnboardingStepDescription,
  OnboardingStepHeader,
  OnboardingStepTitle,
  OnboardingStepper,
} from "@/components/layout/onboarding-layout";
import {
  FeatureBadgeWall,
  QuestionPanel,
} from "@/components/onboarding/feature-badges";
import { useTRPC } from "@/lib/trpc/client";

export function Step3({
  stepperSteps,
  monitorStatus,
  pageStatus,
  onQuestionnaireSubmit,
}: {
  stepperSteps: OnboardingStep[];
  monitorStatus: "skipped" | "completed" | null;
  pageStatus: "skipped" | "completed" | null;
  onQuestionnaireSubmit: (values: {
    source: string;
    other?: string;
  }) => Promise<void>;
}) {
  const monitorSkipped = monitorStatus === "skipped";
  const pageSkipped = pageStatus === "skipped";

  const quickLinks = useMemo(() => {
    type Link = {
      name: string;
      href: string;
      icon: React.ComponentType<{ className?: string }>;
    };

    const priority: Link[] = [];
    if (monitorSkipped) {
      priority.push({ name: "Monitors", href: "/monitors", icon: Monitor });
    }
    if (pageSkipped) {
      priority.push({
        name: "Status Pages",
        href: "/status-pages",
        icon: StatusPage,
      });
    }
    const filler: Link[] = [
      { name: "Invite team", href: "/settings/general", icon: Invite },
      { name: "Notifiers", href: "/notifications", icon: Notification },
      { name: "Overview", href: "/overview", icon: Overview },
      { name: "Billing", href: "/settings/billing", icon: Billing },
    ];
    return [...priority, ...filler].slice(0, 4);
  }, [monitorSkipped, pageSkipped]);

  return (
    <>
      <OnboardingFormColumn>
        <OnboardingStepper steps={stepperSteps} />
        <OnboardingStepHeader>
          <OnboardingStepTitle>You&apos;re live</OnboardingStepTitle>
          <OnboardingStepDescription>
            Jump into the product and explore what openstatus can do.
          </OnboardingStepDescription>
        </OnboardingStepHeader>
        <div className="grid gap-2 sm:grid-cols-2">
          {quickLinks.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              className="border-border bg-background font-commit-mono text-muted-foreground hover:bg-accent hover:text-accent-foreground flex items-center gap-2 rounded-md border px-4 py-2 text-sm transition-colors"
            >
              <link.icon className="h-4 w-4" />
              {link.name}
            </Link>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <OnboardingActions className="flex-wrap">
            <Button asChild>
              <Link href="/overview">
                Continue <Next className="size-3" />
              </Link>
            </Button>
            <Button variant="ghost" asChild>
              <a
                href="https://cal.com/team/openstatus/15min"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Calendar className="size-3" />
                Talk to a founder
              </a>
            </Button>
          </OnboardingActions>
          <p className="text-muted-foreground text-xs">
            SOC2 audit incoming? Ping us for a 14-day free trial.
          </p>
        </div>
        <NoClickopsCard />
      </OnboardingFormColumn>
      <OnboardingResultColumn>
        <QuestionPanel onSubmit={onQuestionnaireSubmit} />
        <FeatureBadgeWall />
      </OnboardingResultColumn>
    </>
  );
}

const TERRAFORM_SNIPPET = `resource "openstatus_monitor" "api" {
  name    = "api-health"
  url     = "https://api.acme.dev/health"
  regions = ["ams", "iad", "syd"]
}

$ terraform apply   # no clickops`;

function NoClickopsCard() {
  const trpc = useTRPC();
  const { data: apiKeys } = useQuery(trpc.apiKey.list.queryOptions());
  const hasKeys = (apiKeys?.length ?? 0) > 0;

  return (
    <FormCard>
      <FormCardHeader>
        <FormCardTitle>Agent-first, no clickops</FormCardTitle>
        <FormCardDescription>
          Monitors, status pages, notifications, private locations — all
          manageable as code. Create an API key and hand it to your agent via{" "}
          <CommonLink
            href="https://www.openstatus.dev/docs/reference/mcp-server"
            rel="noreferrer"
            target="_blank"
          >
            MCP
          </CommonLink>
          , script it with the{" "}
          <CommonLink
            href="https://www.openstatus.dev/docs/reference/cli-reference"
            rel="noreferrer"
            target="_blank"
          >
            CLI
          </CommonLink>
          , or commit it with{" "}
          <CommonLink
            href="https://registry.terraform.io/providers/openstatusHQ/openstatus/latest"
            rel="noreferrer"
            target="_blank"
          >
            Terraform
          </CommonLink>
          .
        </FormCardDescription>
      </FormCardHeader>
      <FormCardContent>
        <Code>{TERRAFORM_SNIPPET}</Code>
      </FormCardContent>
      <FormCardFooter>
        <FormCardFooterInfo>
          Read more in our{" "}
          <CommonLink
            href="https://www.openstatus.dev/docs"
            rel="noreferrer"
            target="_blank"
          >
            docs
          </CommonLink>
          .
        </FormCardFooterInfo>
        {hasKeys ? (
          <Button size="sm" variant="outline" asChild>
            <Link href="/settings/general#api-keys">
              <ApiKey />
              Manage API keys
            </Link>
          </Button>
        ) : (
          <CreateApiKeyDialog>
            <Button size="sm">
              <ApiKey />
              Create API key
            </Button>
          </CreateApiKeyDialog>
        )}
      </FormCardFooter>
    </FormCard>
  );
}
