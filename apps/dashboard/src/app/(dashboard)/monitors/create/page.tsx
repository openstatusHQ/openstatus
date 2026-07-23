"use client";

import { headerAssertion } from "@openstatus/assertions";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useQueryStates } from "nuqs";

import {
  EmptyStateContainer,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import { EmptyStateDescription } from "@/components/content/empty-state";
import {
  Section,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";
import { FormGeneral } from "@/components/forms/monitor/form-general";
import { useTRPC } from "@/lib/trpc/client";

import { searchParamsParsers } from "./search-params";

function safeHostname(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

// prefill from play tools (e.g. /play/cdn-checker): malformed params fall
// back to an empty form rather than erroring
function buildPrefill(params: {
  url: string | null;
  name: string | null;
  assertionHeaderKey: string | null;
  assertionHeaderCompare: string | null;
  assertionHeaderValue: string | null;
}): React.ComponentProps<typeof FormGeneral>["defaultValues"] {
  if (!params.url) return undefined;

  const assertion = headerAssertion.safeParse({
    type: "header",
    version: "v1",
    compare: params.assertionHeaderCompare ?? "eq",
    key: params.assertionHeaderKey,
    target: params.assertionHeaderValue,
  });

  return {
    active: true,
    name: params.name ?? safeHostname(params.url),
    type: "http",
    method: "GET",
    url: params.url,
    headers: [],
    body: "",
    assertions: assertion.success ? [assertion.data] : [],
    skipCheck: false,
    saveCheck: false,
  };
}

export default function Page() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [params] = useQueryStates(searchParamsParsers);

  const triggerCheckMutation = useMutation(
    trpc.checker.triggerChecker.mutationOptions({}),
  );

  const createMonitorMutation = useMutation(
    trpc.monitor.new.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries({
          queryKey: trpc.monitor.list.queryKey(),
        });
        if (data.active) {
          triggerCheckMutation.mutate({ id: data.id });
        }
        router.push(`/monitors/${data.id}/edit`);
      },
    }),
  );

  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>Create Monitor</SectionTitle>
        </SectionHeader>
        <FormGeneral
          defaultValues={buildPrefill(params)}
          onSubmit={async (data) => {
            await createMonitorMutation.mutateAsync({
              name: data.name,
              jobType: data.type,
              url: data.url,
              method: data.method,
              headers: data.headers,
              body: data.body,
              active: data.active,
              assertions: data.assertions,
              saveCheck: data.saveCheck,
              skipCheck: data.skipCheck,
            });
          }}
        />
      </Section>
      <Section>
        <EmptyStateContainer>
          <EmptyStateTitle>Create and start customizing</EmptyStateTitle>
          <EmptyStateDescription>
            Change the <span className="text-foreground">periodicity</span>, set
            up the <span className="text-foreground">regions</span>,{" "}
            <span className="text-foreground">timeout</span> or{" "}
            <span className="text-foreground">degraded</span> duration and
            more...
          </EmptyStateDescription>
        </EmptyStateContainer>
      </Section>
    </SectionGroup>
  );
}
