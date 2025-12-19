"use client";

import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";
import { FormWorkspaceCreate } from "@/components/forms/workspace/form-workspace-create";
import { useTRPC } from "@/lib/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

export function Client() {
  const router = useRouter();
  const trpc = useTRPC();

  const createWorkspaceMutation = useMutation(
    trpc.workspace.createWorkspace.mutationOptions({
      onSuccess: (data) => {
        // Set the workspace slug cookie and redirect
        document.cookie = `workspace-slug=${data.slug}; path=/; max-age=31536000`;
        router.push("/onboarding?step=1");
      },
    }),
  );

  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>Welcome to OpenStatus</SectionTitle>
          <SectionDescription>
            Let&apos;s create your first workspace to get started.
          </SectionDescription>
        </SectionHeader>
      </Section>
      <Section>
        <FormWorkspaceCreate
          onSubmit={async (values) => {
            await createWorkspaceMutation.mutateAsync(values);
            router.push("/onboarding?step=1");
          }}
        />
      </Section>
    </SectionGroup>
  );
}
