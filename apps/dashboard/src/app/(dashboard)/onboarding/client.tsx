"use client";

import {
  ActionCard,
  ActionCardDescription,
  ActionCardGroup,
  ActionCardHeader,
  ActionCardTitle,
} from "@/components/content/action-card";
import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";
import {
  FormCard,
  FormCardContent,
  FormCardDescription,
  FormCardFooter,
  FormCardHeader,
  FormCardTitle,
} from "@/components/forms/form-card";
import { CreateMonitorForm } from "@/components/forms/onboarding/create-monitor";
import { CreatePageForm } from "@/components/forms/onboarding/create-page";
import { QuestionForm } from "@/components/forms/onboarding/question";
import { extractDomain } from "@/lib/domains";
import { useTRPC } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { Button } from "@openstatus/ui/components/ui/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, ArrowUpRight, Layers, PanelTop } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryStates } from "nuqs";
import { useEffect, useMemo } from "react";
import type { Intent } from "./search-params";
import { searchParamsParsers } from "./search-params";

const intents: {
  id: Intent;
  title: string;
  description: string;
  icon: typeof Activity;
}[] = [
  {
    id: "status-page",
    title: "Status Page",
    description:
      "Keep your users informed with a public status page showing your system health.",
    icon: PanelTop,
  },
  {
    id: "monitoring",
    title: "Monitoring",
    description:
      "Track uptime and performance of your websites and APIs from multiple locations.",
    icon: Activity,
  },
  {
    id: "both",
    title: "Status Page & Monitoring",
    description:
      "Monitor your services and share real-time status with your users.",
    icon: Layers,
  },
];

function getTotalSteps(intent: Intent | null): number {
  if (intent === "both") return 4;
  return 3;
}

function getCurrentStepNumber(
  step: string,
  intent: Intent | null,
): number | null {
  if (step === "1") return 1;
  if (step === "2") return 2;
  if (step === "3" && intent === "both") return 3;
  if (step === "next") return null; // no counter on final page
  return null;
}

export function Client() {
  const [{ step, intent, callbackUrl }, setSearchParams] = useQueryStates(
    searchParamsParsers,
    { history: "push" },
  );
  const router = useRouter();
  const pathname = usePathname();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: workspace, refetch } = useQuery(
    trpc.workspace.get.queryOptions(),
  );
  const triggerCheckMutation = useMutation(
    trpc.checker.triggerChecker.mutationOptions({}),
  );
  const createMonitorMutation = useMutation(
    trpc.monitor.new.mutationOptions({
      onSuccess: async (data) => {
        if (intent === "both") {
          await setSearchParams({ step: "3" });
        } else {
          await setSearchParams({ step: "next" });
        }
        if (data.active) {
          triggerCheckMutation.mutate({ id: data.id });
        }
        refetch();
        queryClient.invalidateQueries({
          queryKey: trpc.monitor.list.queryKey(),
        });
      },
    }),
  );
  const createPageMutation = useMutation(trpc.page.create.mutationOptions({}));
  const updateComponentsMutation = useMutation(
    trpc.pageComponent.updateOrder.mutationOptions({}),
  );
  const createFeedbackMutation = useMutation(
    trpc.feedback.submit.mutationOptions({}),
  );

  const totalSteps = getTotalSteps(intent);
  const currentStepNumber = getCurrentStepNumber(step, intent);

  const nudgeCards = useMemo(() => {
    const cards = [
      {
        id: "upgrade",
        title: "Upgrade your plan",
        description:
          "Unlock more monitors, status pages, and advanced features.",
        href: "/settings/billing",
      },
      {
        id: "invite",
        title: "Invite your team",
        description:
          "Collaborate with your team by inviting them to your workspace.",
        href: "/settings/general",
      },
    ];

    if (intent === "monitoring") {
      cards.push({
        id: "status-page",
        title: "Create a status page",
        description:
          "Keep your users informed with a public page showing your system health.",
        href: "/status-pages",
      });
    }

    if (intent === "status-page") {
      cards.push({
        id: "monitor",
        title: "Create a monitor",
        description:
          "Start tracking uptime and performance of your websites and APIs.",
        href: "/monitors",
      });
    }

    cards.push({
      id: "notifier",
      title: "Create a notifier",
      description: "Get notified when your website or API is down.",
      href: "/notifications",
    });

    return cards;
  }, [intent]);

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

  const showMonitorForm =
    (step === "2" && intent === "monitoring") ||
    (step === "2" && intent === "both");

  const showStatusPageForm =
    (step === "2" && intent === "status-page") ||
    (step === "3" && intent === "both");

  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>Getting Started</SectionTitle>
          <SectionDescription>
            Welcome to openstatus. Let&apos;s get you set up.
          </SectionDescription>
        </SectionHeader>
      </Section>
      {step === "1" && (
        <Section>
          <SectionHeader>
            <SectionDescription>What are you looking for?</SectionDescription>
          </SectionHeader>
          <ActionCardGroup className="grid-cols-1 sm:grid-cols-2">
            {intents.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={
                    item.id === "both" ? "text-left sm:col-span-2" : "text-left"
                  }
                  onClick={async () => {
                    setSearchParams({ step: "2", intent: item.id });
                    await createFeedbackMutation.mutateAsync({
                      message: `I'm looking for *${item.title}*`,
                      path: pathname,
                    });
                  }}
                >
                  <ActionCard className="h-full w-full cursor-pointer transition-colors hover:border-foreground/20">
                    <ActionCardHeader>
                      <ActionCardTitle className="flex items-center gap-2">
                        <Icon className="size-4 shrink-0 text-muted-foreground" />
                        {item.title}
                      </ActionCardTitle>
                      <ActionCardDescription>
                        {item.description}
                      </ActionCardDescription>
                    </ActionCardHeader>
                  </ActionCard>
                </button>
              );
            })}
          </ActionCardGroup>
        </Section>
      )}
      {showMonitorForm && (
        <Section>
          <SectionHeader className="h-8 flex-row items-center justify-between">
            <SectionDescription className="tabular-nums">
              Step{" "}
              <span className="font-medium text-foreground">
                {currentStepNumber}
              </span>{" "}
              of{" "}
              <span className="font-medium text-foreground">{totalSteps}</span>
            </SectionDescription>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() =>
                setSearchParams({
                  step: intent === "both" ? "3" : "next",
                })
              }
            >
              Skip
            </Button>
          </SectionHeader>
          <FormCard>
            <FormCardHeader>
              <FormCardTitle>Create a monitor</FormCardTitle>
              <FormCardDescription>
                Get uptime, response time and more for your website or API.
              </FormCardDescription>
            </FormCardHeader>
            <FormCardContent>
              <CreateMonitorForm
                id="create-monitor-form"
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
              />
            </FormCardContent>
            <FormCardFooter>
              <Button form="create-monitor-form">Submit</Button>
            </FormCardFooter>
          </FormCard>
        </Section>
      )}
      {showStatusPageForm && (
        <Section>
          <SectionHeader className="h-8 flex-row items-center justify-between">
            <SectionDescription className="tabular-nums">
              Step{" "}
              <span className="font-medium text-foreground">
                {currentStepNumber}
              </span>{" "}
              of{" "}
              <span className="font-medium text-foreground">{totalSteps}</span>
            </SectionDescription>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => setSearchParams({ step: "next" })}
            >
              Skip
            </Button>
          </SectionHeader>
          <FormCard>
            <FormCardHeader>
              <FormCardTitle>Create a status page</FormCardTitle>
              <FormCardDescription>
                Inform your users about the status of your services.
              </FormCardDescription>
            </FormCardHeader>
            <FormCardContent>
              <CreatePageForm
                id="create-page-form"
                showComponents={intent === "status-page"}
                defaultValues={{
                  slug: extractDomain(createMonitorMutation.data?.url ?? ""),
                }}
                onSubmit={async (values) => {
                  if (!workspace?.id) return;

                  const newPage = await createPageMutation.mutateAsync({
                    slug: values.slug,
                    title: values.slug.replace(/-/g, " "),
                    description: "",
                    monitors: createMonitorMutation.data?.id
                      ? [
                          {
                            monitorId: createMonitorMutation.data.id,
                            order: 0,
                          },
                        ]
                      : [],
                    workspaceId: workspace.id,
                    legacyPage: false,
                  });

                  // Create static components if any were added
                  const staticComponents = values.components?.filter(
                    (c) => c.name.trim() !== "",
                  );
                  if (staticComponents?.length && newPage?.id) {
                    const monitorComponentOffset = createMonitorMutation.data
                      ?.id
                      ? 1
                      : 0;
                    await updateComponentsMutation.mutateAsync({
                      pageId: newPage.id,
                      components: staticComponents.map((c, index) => ({
                        name: c.name,
                        type: "static" as const,
                        monitorId: null,
                        order: index + monitorComponentOffset,
                      })),
                      groups: [],
                    });
                  }

                  await setSearchParams({ step: "next" });
                  refetch();
                  queryClient.invalidateQueries({
                    queryKey: trpc.page.list.queryKey(),
                  });
                }}
              />
            </FormCardContent>
            <FormCardFooter>
              <Button form="create-page-form">Submit</Button>
            </FormCardFooter>
          </FormCard>
        </Section>
      )}
      {step === "next" && (
        <>
          <Section>
            <SectionHeader className="h-8 flex-row items-center justify-between">
              <SectionDescription>
                How did you hear about openstatus?
              </SectionDescription>
            </SectionHeader>
            <QuestionForm
              onSubmit={async (values) => {
                await createFeedbackMutation.mutateAsync({
                  message: `Heard about us via *${values.source}${
                    values.other ? `: ${values.other}` : ""
                  }*`,
                  path: pathname,
                });
              }}
            />
          </Section>
          <Section>
            <SectionHeader>
              <SectionDescription className="tabular-nums">
                What&apos;s next?
              </SectionDescription>
            </SectionHeader>
            <ActionCardGroup className="sm:grid-cols-2">
              {nudgeCards.map((action) => {
                const isExternal = action.href.startsWith("http");
                const className =
                  action.id === "upgrade" ? "bg-muted" : undefined;
                return (
                  <Link
                    key={action.id}
                    href={action.href}
                    target={isExternal ? "_blank" : undefined}
                    rel={isExternal ? "noopener noreferrer" : undefined}
                  >
                    <ActionCard className={cn("h-full w-full", className)}>
                      <ActionCardHeader>
                        <ActionCardTitle className="flex items-center justify-between gap-2">
                          {action.title}
                          {isExternal && (
                            <ArrowUpRight className="size-4 shrink-0 text-muted-foreground group-hover/action-card:text-foreground" />
                          )}
                        </ActionCardTitle>
                        <ActionCardDescription>
                          {action.description}
                        </ActionCardDescription>
                      </ActionCardHeader>
                    </ActionCard>
                  </Link>
                );
              })}
            </ActionCardGroup>
          </Section>
        </>
      )}
    </SectionGroup>
  );
}
