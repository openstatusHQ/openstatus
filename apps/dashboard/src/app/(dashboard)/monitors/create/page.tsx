"use client";

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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

export default function Page() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const createMonitorMutation = useMutation(
    trpc.monitor.new.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries({
          queryKey: trpc.monitor.list.queryKey(),
        });
        router.push(`/monitors/${data.id}/edit`);
      },
    })
  );

  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>Create Monitor</SectionTitle>
        </SectionHeader>
        <FormGeneral
          onSubmit={async (data) => {
            await createMonitorMutation.mutateAsync({
              name: data.name,
              jobType: data.type,
              url: data.url,
              method: data.method,
              headers: data.headers,
              body: data.body,
              assertions: data.assertions,
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
