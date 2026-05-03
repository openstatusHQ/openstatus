"use client";

import {
  OnboardingLayout,
  OnboardingShell,
} from "@/components/layout/onboarding-layout";
import { useStreamChecks } from "@/components/onboarding/use-stream-checks";
import { getCompanyDomainFromEmail } from "@/lib/onboarding/email-domain";
import { useTRPC } from "@/lib/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, PanelTop, Rocket } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryStates } from "nuqs";
import { generateSlug } from "random-word-slugs";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Step1 } from "./_steps/step-1";
import { Step2 } from "./_steps/step-2";
import { Step3 } from "./_steps/step-3";
import { searchParamsParsers } from "./search-params";

const STEPS = [
  { id: "1", label: "Monitor", icon: <Activity /> },
  { id: "2", label: "Status page", icon: <PanelTop /> },
  { id: "3", label: "Launch", icon: <Rocket /> },
] as const;

// Fallback URL used when the user's email domain is generic (gmail, yahoo, …).
// Keeps the magic-moment frictionless: hit submit on an empty form and a real
// probe runs against an openstatus-owned demo target.
const DEMO_FALLBACK_URL = "https://openstat.us";

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

function safeHostname(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export function Client() {
  const [{ step, monitor, page, callbackUrl }, setSearchParams] =
    useQueryStates(searchParamsParsers, { history: "push" });
  const router = useRouter();
  const pathname = usePathname();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const { data: user } = useQuery(trpc.user.get.queryOptions());

  // Invalidate (not refetch) so any mounted subscriber to `workspace.get`
  // (sidebar quota chip, plan-gate selectors, etc.) gets fresh data on the
  // next read. The workspace shape carries derived state like monitor /
  // page counts — letting it go stale after onboarding creates would show
  // wrong numbers when the user lands on /overview.
  const createMonitorMutation = useMutation(
    trpc.monitor.new.mutationOptions({
      onSuccess: async () => {
        await setSearchParams({ monitor: "completed" });
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: trpc.workspace.get.queryKey(),
          }),
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
          queryClient.invalidateQueries({
            queryKey: trpc.workspace.get.queryKey(),
          }),
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

  const defaultUrl = companyDomain
    ? `https://${companyDomain}`
    : DEMO_FALLBACK_URL;

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

  // Trigger streaming preview when the monitor was just created. Cleanup
  // calls `stopChecks()` so navigating away mid-stream (Continue, refresh,
  // unmount) doesn't leak the in-flight fetch.
  useEffect(() => {
    if (!monitorData?.id || step !== "1") return;
    if (checksStartedRef.current) return;
    checksStartedRef.current = true;
    startChecks(monitorData.id);
    return () => {
      stopChecks();
    };
  }, [monitorData?.id, step, startChecks, stopChecks]);

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

  // Compare by index, not `Number(step)`, so `STEPS` can adopt non-numeric
  // ids later (e.g. "done", "review") without silently regressing the
  // completed/upcoming derivation.
  const currentStepIndex = STEPS.findIndex((s) => s.id === step);
  const stepperSteps = STEPS.map((s, i) => ({
    id: s.id,
    label: s.label,
    icon: s.icon,
    status:
      step === s.id
        ? ("current" as const)
        : currentStepIndex > i
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
              // Form schema validates URL shape, but `safeHostname` is a
              // belt-and-suspenders fallback so a sneaky-but-parseable form
              // value (e.g. relative URL slipping through) doesn't throw
              // synchronously inside `mutateAsync`.
              await createMonitorMutation.mutateAsync({
                url: values.url,
                name: safeHostname(values.url) ?? values.url,
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
            createdPageData={pageData}
            slugFallback={slugFallback}
            monitorSkipped={monitor === "skipped"}
            monitorName={
              monitorData?.url ? safeHostname(monitorData.url) : null
            }
            isSubmitting={createPageMutation.isPending}
            onSubmit={async (values) => {
              if (!workspace?.id) return;
              const newPage = await createPageMutation.mutateAsync({
                slug: values.slug,
                title: values.slug.replace(/-/g, " "),
                description: "",
                monitors: monitorData?.id
                  ? [{ monitorId: monitorData.id, order: 0 }]
                  : [],
                workspaceId: workspace.id,
                legacyPage: false,
                forceTheme: values.forceTheme,
                configuration: { theme: values.theme },
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
            onContinue={() => setSearchParams({ step: "3" })}
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
