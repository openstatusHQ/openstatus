"use client";

import { CreateMonitorForm } from "@/components/forms/onboarding/create-monitor";
import { CreatePageForm } from "@/components/forms/onboarding/create-page";
import {
  OnboardingActions,
  OnboardingFormColumn,
  OnboardingLayout,
  OnboardingLockedSummary,
  OnboardingPreviewPlaceholder,
  OnboardingPreviewPlaceholderContent,
  OnboardingPreviewPlaceholderOverlay,
  OnboardingPreviewPlaceholderText,
  OnboardingResultColumn,
  OnboardingResultHeading,
  OnboardingShell,
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
import {
  FeatureBadgeWall,
  QuestionPanel,
} from "@/components/onboarding/feature-badges";
import {
  DEMO_PREVIEW_SLUG,
  StatusPageIframePreview,
} from "@/components/onboarding/iframe-preview";
import { useStreamChecks } from "@/components/onboarding/use-stream-checks";
import { exampleChecks } from "@/data/onboarding-checks";
import { getCompanyDomainFromEmail } from "@/lib/onboarding/email-domain";
import { useTRPC } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { AVAILABLE_REGIONS } from "@openstatus/regions";
import { Button } from "@openstatus/ui/components/ui/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  Bell,
  Calendar,
  Cog,
  LayoutGrid,
  PanelTop,
  Rocket,
  UserPlus,
} from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryStates } from "nuqs";
import { generateSlug } from "random-word-slugs";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { searchParamsParsers } from "./search-params";

const STEPS = [
  { id: "1", label: "Monitor", icon: <Activity /> },
  { id: "2", label: "Status page", icon: <PanelTop /> },
  { id: "3", label: "Launch", icon: <Rocket /> },
] as const;

const TOTAL_REGIONS = AVAILABLE_REGIONS.length;

// Convert a hostname to a slug that satisfies the page schema
// (`[A-Za-z0-9-]`, min length 3). Caller must pass a hostname — strip URL
// scheme/`www` upstream.
//
// Picks the registrable label (penultimate segment) when present so
// `api.mycompany.com` → `mycompany` rather than the generic `api`.
function slugifyHostname(hostname: string): string {
  const labels = hostname
    .toLowerCase()
    .replace(/^www\./, "")
    .split(".");
  const base = labels.length > 1 ? labels[labels.length - 2] : labels[0];
  return base
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
}

export function Client() {
  const [{ step, monitor, page, callbackUrl }, setSearchParams] =
    useQueryStates(searchParamsParsers, { history: "push" });
  const router = useRouter();
  const pathname = usePathname();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { theme: dashboardTheme } = useTheme();

  const { data: workspace, refetch: refetchWorkspace } = useQuery(
    trpc.workspace.get.queryOptions(),
  );
  const { data: user } = useQuery(trpc.user.get.queryOptions());

  const createMonitorMutation = useMutation(
    trpc.monitor.new.mutationOptions({
      onSuccess: async () => {
        await setSearchParams({ monitor: "completed" });
        await Promise.all([
          refetchWorkspace(),
          queryClient.invalidateQueries({
            queryKey: trpc.monitor.list.queryKey(),
          }),
        ]);
      },
    }),
  );
  const createPageMutation = useMutation(
    trpc.page.create.mutationOptions({
      onSuccess: async () => {
        await setSearchParams({ page: "completed" });
        await Promise.all([
          refetchWorkspace(),
          queryClient.invalidateQueries({
            queryKey: trpc.page.list.queryKey(),
          }),
        ]);
      },
    }),
  );
  const updateComponentsMutation = useMutation(
    trpc.pageComponent.updateOrder.mutationOptions({}),
  );
  const createFeedbackMutation = useMutation(
    trpc.feedback.submit.mutationOptions({}),
  );

  const {
    results: checkResults,
    isStreaming,
    start: startChecks,
    stop: stopChecks,
  } = useStreamChecks();
  const checksStartedRef = useRef(false);

  const monitorData = createMonitorMutation.data;
  const pageData = createPageMutation.data;

  const companyDomain = useMemo(
    () => getCompanyDomainFromEmail(user?.email),
    [user?.email],
  );

  const defaultUrl = companyDomain ? `https://${companyDomain}` : undefined;

  const slugFallback = useMemo(() => {
    const candidates: string[] = [];
    if (monitorData?.url) {
      try {
        candidates.push(slugifyHostname(new URL(monitorData.url).hostname));
      } catch {
        // Malformed URL — fall through to other candidates.
      }
    }
    if (companyDomain) candidates.push(slugifyHostname(companyDomain));
    const valid = candidates.find((c) => c.length >= 3);
    if (valid) return valid;
    return generateSlug(2, { format: "kebab" });
  }, [monitorData?.url, companyDomain]);

  // Trigger streaming preview when the monitor was just created.
  useEffect(() => {
    if (!monitorData?.id || step !== "1") return;
    if (checksStartedRef.current) return;
    checksStartedRef.current = true;
    startChecks(monitorData.id);
  }, [monitorData?.id, step, startChecks]);

  // Optional callbackUrl redirect after sign-in flows that bounce through onboarding.
  useEffect(() => {
    if (!callbackUrl) return;
    try {
      const url = new URL(callbackUrl, window.location.origin);
      if (url.pathname === "/" || url.pathname === "") return;
      if (url.origin !== window.location.origin) return;
      if (url.protocol !== "http:" && url.protocol !== "https:") return;
      router.push(`${url.pathname}${url.search}${url.hash}`);
    } catch {
      // Malformed URLs are not safe to navigate to
    }
  }, [callbackUrl, router]);

  // Fire telemetry when the user clicks Continue on step 3.
  // Was previously two `useEffect`s gated on a ref — moved to an explicit
  // user action so the side-effect only fires when the user actually
  // commits to "I'm done", not whenever they land on the route.
  const emitOnboardingTelemetry = useCallback(() => {
    createFeedbackMutation.mutate({
      source: "onboarding-completed",
      message: `monitor=${monitor ?? "untouched"} page=${page ?? "untouched"}`,
      path: pathname,
    });
    // Strong-intent: user followed at least one of the steps to completion.
    let intentMessage = "";
    if (monitor === "completed" && page === "completed") {
      intentMessage = "Status Page & Monitoring";
    } else if (monitor === "completed") {
      intentMessage = "Monitoring";
    } else if (page === "completed") {
      intentMessage = "Status Page";
    }
    if (intentMessage) {
      createFeedbackMutation.mutate({
        source: "onboarding-intent",
        message: intentMessage,
        path: pathname,
      });
    }
  }, [createFeedbackMutation.mutate, monitor, page, pathname]);

  const stepperSteps = STEPS.map((s) => ({
    id: s.id,
    label: s.label,
    icon: s.icon,
    status:
      step === s.id
        ? ("current" as const)
        : Number(step) > Number(s.id)
          ? ("completed" as const)
          : ("upcoming" as const),
  }));

  return (
    <OnboardingLayout>
      <OnboardingShell>
        {step === "1" ? (
          <Step1
            stepperSteps={stepperSteps}
            monitorStatus={monitor}
            defaultUrl={defaultUrl}
            isSubmitting={createMonitorMutation.isPending}
            monitorData={monitorData}
            checkResults={checkResults}
            isStreaming={isStreaming}
            onSubmit={async (values) => {
              await createMonitorMutation.mutateAsync({
                url: values.url,
                name: new URL(values.url).hostname,
                method: "GET",
                headers: [],
                assertions: [],
                jobType: "http",
                active: true,
              });
            }}
            onSkip={() => setSearchParams({ monitor: "skipped", step: "2" })}
            onContinue={() => {
              setSearchParams({ step: "2" });
              stopChecks();
            }}
            onRetryChecks={() => {
              if (monitorData?.id) startChecks(monitorData.id);
            }}
          />
        ) : null}
        {step === "2" ? (
          <Step2
            stepperSteps={stepperSteps}
            pageStatus={page}
            slugFallback={slugFallback}
            monitorSkipped={monitor === "skipped"}
            createdPageData={
              pageData ? { id: pageData.id, slug: pageData.slug } : undefined
            }
            isSubmitting={createPageMutation.isPending}
            onSubmit={async (values) => {
              if (!workspace?.id) return;
              // Match the user's current dashboard theme so the freshly
              // published page renders consistent with what they're seeing.
              const forceTheme =
                dashboardTheme === "dark" || dashboardTheme === "light"
                  ? dashboardTheme
                  : "system";
              const newPage = await createPageMutation.mutateAsync({
                slug: values.slug,
                title: values.slug.replace(/-/g, " "),
                description: "",
                monitors: monitorData?.id
                  ? [{ monitorId: monitorData.id, order: 0 }]
                  : [],
                workspaceId: workspace.id,
                legacyPage: false,
                forceTheme,
              });
              const staticComponents = values.components?.filter(
                (c) => c.name.trim() !== "",
              );
              if (staticComponents?.length && newPage?.id) {
                const offset = monitorData?.id ? 1 : 0;
                await updateComponentsMutation.mutateAsync({
                  pageId: newPage.id,
                  components: staticComponents.map((c, index) => ({
                    name: c.name,
                    type: "static" as const,
                    monitorId: null,
                    order: index + offset,
                  })),
                  groups: [],
                });
              }
            }}
            onSkip={() => setSearchParams({ page: "skipped", step: "3" })}
            onContinue={() => {
              setSearchParams({ step: "3" });
            }}
          />
        ) : null}
        {step === "3" ? (
          <Step3
            stepperSteps={stepperSteps}
            monitorStatus={monitor}
            pageStatus={page}
            onContinue={emitOnboardingTelemetry}
            onQuestionnaireSubmit={async (values) => {
              await createFeedbackMutation.mutateAsync({
                source: "onboarding-source",
                message: `Heard about us via ${values.source}${
                  values.other ? `: ${values.other}` : ""
                }`,
                path: pathname,
              });
            }}
          />
        ) : null}
      </OnboardingShell>
    </OnboardingLayout>
  );
}

// =============================================================================
// Step 1 — Monitor
// =============================================================================

function Step1({
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
  monitorData: { id: number; url: string } | undefined;
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
        <OnboardingResultHeading>Live checks</OnboardingResultHeading>
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
          Hit run to watch results land here from every region as they finish —
          usually under 3 seconds total.
        </OnboardingPreviewPlaceholderText>
      </OnboardingPreviewPlaceholderOverlay>
    </OnboardingPreviewPlaceholder>
  );
}

// =============================================================================
// Step 2 — Status page
// =============================================================================

function Step2({
  stepperSteps,
  pageStatus,
  slugFallback,
  monitorSkipped,
  createdPageData,
  isSubmitting,
  onSubmit,
  onSkip,
  onContinue,
}: {
  stepperSteps: OnboardingStep[];
  pageStatus: "skipped" | "completed" | null;
  slugFallback: string;
  monitorSkipped: boolean;
  createdPageData: { id: number; slug: string } | undefined;
  isSubmitting: boolean;
  onSubmit: (values: {
    slug: string;
    components?: { name: string }[];
  }) => Promise<void>;
  onSkip: () => void;
  onContinue: () => void;
}) {
  const isLocked = pageStatus === "completed" && !!createdPageData;

  return (
    <>
      <OnboardingFormColumn>
        <OnboardingStepper steps={stepperSteps} />
        <OnboardingStepHeader>
          <OnboardingStepTitle>Publish a status page</OnboardingStepTitle>
          <OnboardingStepDescription>
            Pick a subdomain. Your page goes live the moment you publish — share
            the link, embed a badge, or hand it to support.
          </OnboardingStepDescription>
        </OnboardingStepHeader>
        {isLocked ? (
          <OnboardingLockedSummary
            value={`${createdPageData?.slug}.openstatus.dev`}
            href={`https://${createdPageData?.slug}.openstatus.dev`}
            helper="Theme, components, and visibility are editable later from page settings."
          />
        ) : (
          <CreatePageForm
            id="onboarding-page-form"
            showComponents={monitorSkipped}
            defaultValues={{ slug: slugFallback }}
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
                form="onboarding-page-form"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting ? "Publishing…" : "Publish my page"}
              </Button>
              <Button variant="ghost" onClick={onSkip} type="button">
                Do this later
              </Button>
            </>
          )}
        </OnboardingActions>
      </OnboardingFormColumn>
      <OnboardingResultColumn>
        <OnboardingResultHeading>Live preview</OnboardingResultHeading>
        {!isLocked ? (
          <StatusPagePreviewPlaceholder />
        ) : (
          <StatusPageIframePreview slug={createdPageData?.slug ?? ""} />
        )}
      </OnboardingResultColumn>
    </>
  );
}

function StatusPagePreviewPlaceholder(
  props: Omit<
    React.ComponentProps<typeof OnboardingPreviewPlaceholder>,
    "children"
  >,
) {
  return (
    <OnboardingPreviewPlaceholder
      className={cn("flex h-[calc(100dvh-13rem)] md:h-auto", props.className)}
      {...props}
    >
      <OnboardingPreviewPlaceholderContent className="flex-1 [&>div]:h-full [&_iframe]:h-full [&_iframe]:max-h-none">
        <StatusPageIframePreview slug={DEMO_PREVIEW_SLUG} />
      </OnboardingPreviewPlaceholderContent>
      <OnboardingPreviewPlaceholderOverlay>
        <OnboardingPreviewPlaceholderText>
          Pick a subdomain to see your live status page render here.
        </OnboardingPreviewPlaceholderText>
      </OnboardingPreviewPlaceholderOverlay>
    </OnboardingPreviewPlaceholder>
  );
}

// =============================================================================
// Step 3 — Done
// =============================================================================

function Step3({
  stepperSteps,
  monitorStatus,
  pageStatus,
  onContinue,
  onQuestionnaireSubmit,
}: {
  stepperSteps: OnboardingStep[];
  monitorStatus: "skipped" | "completed" | null;
  pageStatus: "skipped" | "completed" | null;
  onContinue: () => void;
  onQuestionnaireSubmit: (values: {
    source: string;
    other?: string;
  }) => Promise<void>;
}) {
  const monitorSkipped = monitorStatus === "skipped";
  const pageSkipped = pageStatus === "skipped";

  const quickLinks = useMemo(() => {
    const links: {
      name: string;
      href: string;
      icon: React.ComponentType<{ className?: string }>;
    }[] = [];
    if (monitorSkipped) {
      links.push({ name: "Monitors", href: "/monitors", icon: Activity });
    }
    if (pageSkipped) {
      links.push({
        name: "Status Pages",
        href: "/status-pages",
        icon: PanelTop,
      });
    }
    links.push(
      { name: "Invite team", href: "/settings/general", icon: UserPlus },
      { name: "Notifiers", href: "/notifications", icon: Bell },
      { name: "Overview", href: "/overview", icon: LayoutGrid },
      { name: "Settings", href: "/settings/general", icon: Cog },
    );
    return links.slice(0, 4);
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
              <Link href="/overview" onClick={onContinue}>
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
