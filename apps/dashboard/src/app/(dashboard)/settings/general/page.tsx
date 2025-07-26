"use client";

import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";
import { FormCardGroup } from "@/components/forms/form-card";
import { FormApiKey } from "@/components/forms/settings/form-api-key";
import { FormMembers } from "@/components/forms/settings/form-members";
import { FormSlug } from "@/components/forms/settings/form-slug";
import { FormWorkspace } from "@/components/forms/settings/form-workspace";
import { useTRPC } from "@/lib/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const BASE_URL = "https://app.openstatus.dev/";

export default function Page() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const updateWorkspaceNameMutation = useMutation(
    trpc.workspace.updateName.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.workspace.list.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.workspace.get.queryKey(),
        });
      },
    }),
  );
  const sendInvitationMutation = useMutation(
    trpc.emailRouter.sendTeamInvitation.mutationOptions(),
  );
  const createInvitationMutation = useMutation(
    trpc.invitation.create.mutationOptions({
      onSuccess: (data) => {
        sendInvitationMutation.mutate({ id: data.id, baseUrl: BASE_URL });
        queryClient.invalidateQueries({
          queryKey: trpc.invitation.list.queryKey(),
        });
      },
    }),
  );

  if (!workspace) return null;

  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>General</SectionTitle>
          <SectionDescription>
            Manage your workspace settings.
          </SectionDescription>
        </SectionHeader>
        <FormCardGroup>
          <FormWorkspace
            defaultValues={{ name: workspace.name || "" }}
            onSubmit={async (values) => {
              await updateWorkspaceNameMutation.mutateAsync({
                name: values.name,
              });
            }}
          />
          <FormSlug defaultValues={{ slug: workspace.slug }} />
          <FormMembers
            onCreate={async (values) => {
              await createInvitationMutation.mutateAsync({
                email: values.email,
              });
            }}
            locked={
              (typeof workspace.limits.members === "number" &&
                workspace.limits.members === 1) ||
              workspace.limits.members !== "Unlimited"
            }
          />
          <FormApiKey />
        </FormCardGroup>
      </Section>
    </SectionGroup>
  );
}
