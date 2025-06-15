"use client";

import {
  EmptyStateDescription,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import { EmptyStateContainer } from "@/components/content/empty-state";
import {
  Section,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";
import { FormGeneral } from "@/components/forms/status-page/form-general";
import { useTRPC } from "@/lib/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

export function Client() {
  const trpc = useTRPC();
  const router = useRouter();
  const createStatusPageMutation = useMutation(
    trpc.page.new.mutationOptions({
      onSuccess: (data) => router.push(`/status-pages/${data.id}/edit`),
    })
  );

  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>Create Status Page</SectionTitle>
        </SectionHeader>
        <FormGeneral
          onSubmit={async (values) => {
            await createStatusPageMutation.mutateAsync({
              title: values.title,
              slug: values.slug,
              icon: values.icon,
              description: values.description,
            });
          }}
        />
      </Section>
      <Section>
        <EmptyStateContainer>
          <EmptyStateTitle>Create and start customizing</EmptyStateTitle>
          <EmptyStateDescription>
            Connect your <span className="text-foreground">monitors</span>, set
            up a <span className="text-foreground">custom domain</span>,{" "}
            <span className="text-foreground">password protect</span> it and
            more...
          </EmptyStateDescription>
        </EmptyStateContainer>
      </Section>
    </SectionGroup>
  );
}
