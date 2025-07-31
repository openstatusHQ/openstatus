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
import { LearnFromForm } from "@/components/forms/onboarding/learn-from";
import { Button } from "@/components/ui/button";
import { useTRPC } from "@/lib/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useQueryStates } from "nuqs";
import { searchParamsParsers } from "./search-params";

const moreActions = [
  {
    id: "notifier",
    title: "Create a notifier",
    description: "Get notified when your website or API is down.",
    href: "/notifications",
  },
  {
    id: "workspace",
    title: "Setup workspace",
    description: "Add a name to your workspace and share it with your team.",
    href: "/settings/general",
  },
  {
    id: "monitor",
    title: "Update monitor",
    description: "Change region, schedule, timeout and more.",
    href: "/monitors",
  },
  {
    id: "cal",
    title: "Schedule a call",
    description: "Book a meeting with us to get you started with OpenStatus.",
    href: "https://openstatus.dev/cal",
  },
  {
    id: "docs",
    title: "Documentation",
    description: "Read our documentation to get started with OpenStatus.",
    href: "https://docs.openstatus.dev",
  },
  {
    id: "changelog",
    title: "Changelog",
    description: "See what's new in OpenStatus.",
    href: "https://openstatus.dev/changelog",
  },
  {
    id: "discord",
    title: "Discord",
    description: "Join our Discord server if you get stuck.",
    href: "https://discord.gg/openstatus",
  },
  {
    id: "github",
    title: "GitHub",
    description: "Give us a star on GitHub, request features or report issues.",
    href: "https://github.com/openstatus-dev/openstatus",
  },
];

export function Client() {
  const [{ step }, setSearchParams] = useQueryStates(searchParamsParsers);
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: workspace, refetch } = useQuery(
    trpc.workspace.get.queryOptions(),
  );
  const createMonitorMutation = useMutation(
    trpc.monitor.create.mutationOptions({
      onSuccess: () => {
        setSearchParams({ step: "2" });
        refetch();
        queryClient.invalidateQueries({
          queryKey: trpc.monitor.list.queryKey(),
        });
      },
    }),
  );
  const createPageMutation = useMutation(
    trpc.page.create.mutationOptions({
      onSuccess: () => {
        setSearchParams({ step: "next" });
        refetch();
        queryClient.invalidateQueries({
          queryKey: trpc.page.list.queryKey(),
        });
      },
    }),
  );
  const createFeedbackMutation = useMutation(
    trpc.feedback.submit.mutationOptions({}),
  );

  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>Getting Started</SectionTitle>
          <SectionDescription>
            Welcome to OpenStatus. Let&apos;s get you set up.
          </SectionDescription>
        </SectionHeader>
      </Section>
      {step === "1" && (
        <Section>
          <SectionHeader>
            <SectionDescription className="tabular-nums">
              Step <span className="font-medium text-foreground">1</span> of{" "}
              <span className="font-medium text-foreground">2</span>
            </SectionDescription>
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
                    // FIXME: undefined values should be allowed
                    headers: [],
                    assertions: undefined,
                    jobType: "http",
                    // FIXME: check which regions are available on free plan
                    regions: ["ams", "iad", "syd"],
                    active: true,
                    public: false,
                    workspaceId: workspace?.id,
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
      {step === "2" && (
        <Section>
          <SectionHeader>
            <SectionDescription className="tabular-nums">
              Step <span className="font-medium text-foreground">2</span> of{" "}
              <span className="font-medium text-foreground">2</span>
            </SectionDescription>
          </SectionHeader>
          <FormCard>
            <FormCardHeader>
              <FormCardTitle>Create a page</FormCardTitle>
              <FormCardDescription>
                Inform your users about the status of your website or API.
              </FormCardDescription>
            </FormCardHeader>
            <FormCardContent>
              <CreatePageForm
                id="create-page-form"
                onSubmit={async (values) => {
                  if (!workspace?.id) return;

                  await createPageMutation.mutateAsync({
                    slug: values.slug,
                    title: values.slug.replace(/-/g, " "),
                    description: "",
                    monitors: createMonitorMutation.data?.id
                      ? [{ monitorId: createMonitorMutation.data.id, order: 0 }]
                      : [],
                    workspaceId: workspace.id,
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
            <SectionHeader>
              <SectionDescription>
                We&apos;d love to know how you heard about us. This will help us
                improve our product and services.
              </SectionDescription>
            </SectionHeader>
            <LearnFromForm
              onSubmit={async (values) => {
                await createFeedbackMutation.mutateAsync({
                  message: `I learned about OpenStatus from *${values.from}${
                    values.other ? `: ${values.other}` : ""
                  }*`,
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
              {moreActions.map((action) => {
                const isExternal = action.href.startsWith("http");
                const isMonitor = action.id === "monitor";
                const href =
                  isMonitor && createMonitorMutation.data?.id
                    ? `${action.href}/${createMonitorMutation.data.id}`
                    : action.href;
                return (
                  <Link
                    key={action.id}
                    href={href}
                    target={isExternal ? "_blank" : undefined}
                    rel={isExternal ? "noopener noreferrer" : undefined}
                  >
                    <ActionCard className="h-full w-full">
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
