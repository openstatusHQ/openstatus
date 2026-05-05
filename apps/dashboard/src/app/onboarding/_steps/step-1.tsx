"use client";

import { CreateMonitorForm } from "@/components/forms/onboarding/create-monitor";
import {
  OnboardingActions,
  OnboardingFormColumn,
  OnboardingLockedSummary,
  OnboardingPreviewPlaceholder,
  OnboardingPreviewPlaceholderContent,
  OnboardingPreviewPlaceholderOverlay,
  OnboardingPreviewPlaceholderText,
  OnboardingResultColumn,
  OnboardingResultHeading,
  type OnboardingStep,
  OnboardingStepDescription,
  OnboardingStepHeader,
  OnboardingStepTitle,
  OnboardingStepper,
} from "@/components/layout/onboarding-layout";
import {
  type OnboardingChecksRow,
  OnboardingChecksTable,
} from "@/components/onboarding/checks-table";
import { checkResultToResponseLog } from "@/components/onboarding/checks-table-adapter";
import type { useStreamChecks } from "@/components/onboarding/use-stream-checks";
import { exampleChecks } from "@/data/onboarding-checks";
import { cn } from "@/lib/utils";
import { AVAILABLE_REGIONS } from "@openstatus/regions";
import { Button } from "@openstatus/ui/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useMemo } from "react";
import type { OnboardingMonitor } from "../client";

const TOTAL_REGIONS = AVAILABLE_REGIONS.length;

export function Step1({
  stepperSteps,
  monitorStatus,
  defaultUrl,
  isSubmitting,
  monitorData,
  checkResults,
  isStreaming,
  onSubmit,
  onSkip,
  onContinue,
  onRetryChecks,
}: {
  stepperSteps: OnboardingStep[];
  monitorStatus: "skipped" | "completed" | null;
  defaultUrl: string | undefined;
  isSubmitting: boolean;
  monitorData: OnboardingMonitor | undefined;
  checkResults: ReturnType<typeof useStreamChecks>["results"];
  isStreaming: boolean;
  onSubmit: (values: { url: string }) => Promise<void>;
  onSkip: () => void;
  onContinue: () => void;
  onRetryChecks: () => void;
}) {
  const isLocked = monitorStatus === "completed" && !!monitorData;
  // Drop error-state probes and zero-status successes — those rows are
  // noise (timeouts, auth misses, regions our checker can't currently
  // reach) and clutter the table without telling the user anything.
  const successfulResults = useMemo(
    () =>
      checkResults.filter((r) => r.state === "success" && (r.status ?? 0) > 0),
    [checkResults],
  );
  const checksRows: OnboardingChecksRow[] = useMemo(
    () =>
      successfulResults.map((r) =>
        checkResultToResponseLog(
          r,
          monitorData?.id ?? 0,
          monitorData?.url ?? "",
        ),
      ),
    [successfulResults, monitorData?.id, monitorData?.url],
  );
  const allFailed =
    !isStreaming && checkResults.length > 0 && successfulResults.length === 0;

  return (
    <>
      <OnboardingFormColumn>
        <OnboardingStepper steps={stepperSteps} />
        <OnboardingStepHeader>
          <OnboardingStepTitle>
            Check your URL from {TOTAL_REGIONS} regions
          </OnboardingStepTitle>
          <OnboardingStepDescription>
            Drop in your API or website. We&apos;ll run a real check from every
            openstatus region — first results land in under a second.
          </OnboardingStepDescription>
        </OnboardingStepHeader>
        {isLocked ? (
          <OnboardingLockedSummary
            value={monitorData?.url ?? ""}
            href={monitorData?.url}
            helper="Rename, retarget, or tune this monitor later from its settings page."
          />
        ) : (
          <CreateMonitorForm
            id="onboarding-monitor-form"
            defaultValues={defaultUrl ? { url: defaultUrl } : undefined}
            onSubmit={onSubmit}
          />
        )}
        <OnboardingActions>
          {isLocked ? (
            <Button onClick={onContinue}>
              Continue <ArrowRight className="size-3" />
            </Button>
          ) : (
            <>
              <Button
                form="onboarding-monitor-form"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting ? "Running…" : "Run first check"}
              </Button>
              <Button variant="ghost" onClick={onSkip} type="button">
                I don&apos;t have a URL
              </Button>
            </>
          )}
        </OnboardingActions>
      </OnboardingFormColumn>
      <OnboardingResultColumn>
        <OnboardingResultHeading>Global Checks</OnboardingResultHeading>
        {!isLocked ? (
          <ChecksPreviewPlaceholder />
        ) : (
          <OnboardingChecksTable
            rows={checksRows}
            totalRegions={TOTAL_REGIONS}
            isStreaming={isStreaming}
            allFailed={allFailed}
            url={monitorData?.url}
            onRetry={onRetryChecks}
          />
        )}
      </OnboardingResultColumn>
    </>
  );
}

function ChecksPreviewPlaceholder(
  props: Omit<
    React.ComponentProps<typeof OnboardingPreviewPlaceholder>,
    "children"
  >,
) {
  return (
    <OnboardingPreviewPlaceholder
      className={cn("flex flex-col", props.className)}
      {...props}
    >
      <OnboardingPreviewPlaceholderContent className="flex-col md:flex-1 md:[&>div]:flex-1">
        <OnboardingChecksTable
          rows={exampleChecks}
          totalRegions={exampleChecks.length}
          isStreaming={false}
          allFailed={false}
          onRetry={() => {}}
        />
      </OnboardingPreviewPlaceholderContent>
      <OnboardingPreviewPlaceholderOverlay>
        <OnboardingPreviewPlaceholderText>
          Hit run to watch results land here from every region as they finish.
        </OnboardingPreviewPlaceholderText>
      </OnboardingPreviewPlaceholderOverlay>
    </OnboardingPreviewPlaceholder>
  );
}
