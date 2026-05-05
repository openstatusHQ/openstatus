"use client";

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
import { Button } from "@openstatus/ui/components/ui/button";
import {
  Activity,
  ArrowRight,
  Bell,
  Calendar,
  CreditCard,
  LayoutGrid,
  PanelTop,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

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
      priority.push({ name: "Monitors", href: "/monitors", icon: Activity });
    }
    if (pageSkipped) {
      priority.push({
        name: "Status Pages",
        href: "/status-pages",
        icon: PanelTop,
      });
    }
    const filler: Link[] = [
      { name: "Invite team", href: "/settings/general", icon: UserPlus },
      { name: "Notifiers", href: "/notifications", icon: Bell },
      { name: "Overview", href: "/overview", icon: LayoutGrid },
      { name: "Billing", href: "/settings/billing", icon: CreditCard },
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
              className="flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 font-commit-mono text-muted-foreground text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
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
                Continue <ArrowRight className="size-3" />
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
      </OnboardingFormColumn>
      <OnboardingResultColumn>
        <QuestionPanel onSubmit={onQuestionnaireSubmit} />
        <FeatureBadgeWall />
      </OnboardingResultColumn>
    </>
  );
}
