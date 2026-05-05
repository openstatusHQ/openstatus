"use client";

import {
  OnboardingLayout,
  OnboardingShell,
} from "@/components/layout/onboarding-layout";
import { useStreamChecks } from "@/components/onboarding/use-stream-checks";
import { getCompanyDomainFromEmail } from "@/lib/onboarding/email-domain";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@openstatus/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, PanelTop, Rocket } from "lucide-react";
import { usePathname } from "next/navigation";
import { useQueryStates } from "nuqs";
import { generateSlug } from "random-word-slugs";
import { useEffect, useMemo, useRef } from "react";
import { Step1 } from "./_steps/step-1";
import { Step2 } from "./_steps/step-2";
import { Step3 } from "./_steps/step-3";
import { searchParamsParsers } from "./search-params";

export type OnboardingMonitor = Pick<
  RouterOutputs["monitor"]["list"][number],
  "id" | "url"
>;
export type OnboardingPage = Pick<
  RouterOutputs["page"]["list"][number],
  "id" | "slug" | "title"
>;

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
  const [{ step, monitor, page }, setSearchParams] = useQueryStates(
    searchParamsParsers,
    { history: "push" },
  );
  const pathname = usePathname();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const { data: user } = useQuery(trpc.user.get.queryOptions());
  // Ground truth for refresh + returning-user state.
  const { data: monitors } = useQuery(trpc.monitor.list.queryOptions());
  const { data: pages } = useQuery(trpc.page.list.queryOptions());

  // Invalidate so workspace counts (sidebar quota, plan gates) stay fresh.
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

  // Fresh mutation data wins; fall back to the most recent server row.
  const monitorData: OnboardingMonitor | undefined =
    createMonitorMutation.data ??
    (monitors?.[0] ? { id: monitors[0].id, url: monitors[0].url } : undefined);
  const pageData: OnboardingPage | undefined =
    createPageMutation.data ??
    (pages?.[0]
      ? {
          id: pages[0].id,
          slug: pages[0].slug,
          title: pages[0].title,
        }
      : undefined);

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

  // Auto-fire on step-1 fresh-create + refresh-of-locked. Skip on stale
  // hydration so returning users don't accidentally re-probe.
  useEffect(() => {
    if (!monitorData?.id || step !== "1" || monitor !== "completed") return;
    if (checksStartedRef.current) return;
    checksStartedRef.current = true;
    startChecks(monitorData.id);
    return () => {
      stopChecks();
    };
  }, [monitorData?.id, step, monitor, startChecks, stopChecks]);

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
