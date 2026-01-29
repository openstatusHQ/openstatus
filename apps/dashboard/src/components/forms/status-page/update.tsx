import { Link } from "@/components/common/link";
import { Note } from "@/components/common/note";
import { FormCardGroup } from "@/components/forms/form-card";
import { useTRPC } from "@/lib/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Info } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { FormAppearance } from "./form-appearance";
import { FormCustomDomain } from "./form-custom-domain";
import { FormDangerZone } from "./form-danger-zone";
import { FormGeneral } from "./form-general";
import { FormLinks } from "./form-links";
import { FormPageAccess } from "./form-page-access";

export function FormStatusPageUpdate() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const trpc = useTRPC();
  const { data: statusPage, refetch } = useQuery(
    trpc.page.get.queryOptions({ id: Number.parseInt(id) }),
  );
  const queryClient = useQueryClient();
  const { data: monitors } = useQuery(trpc.monitor.list.queryOptions());
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const updateStatusPageMutation = useMutation(
    trpc.page.updateGeneral.mutationOptions({
      onSuccess: () => {
        refetch();
        // NOTE: invalidate status page list to update name
        queryClient.invalidateQueries({
          queryKey: trpc.page.list.queryKey(),
        });
      },
    }),
  );

  const updatePasswordProtectionMutation = useMutation(
    trpc.page.updatePasswordProtection.mutationOptions({
      onSuccess: () => refetch(),
    }),
  );

  const updateCustomDomainMutation = useMutation(
    trpc.page.updateCustomDomain.mutationOptions({
      onSuccess: () => refetch(),
    }),
  );

  const updatePageAppearanceMutation = useMutation(
    trpc.page.updateAppearance.mutationOptions({
      onSuccess: () => refetch(),
    }),
  );

  const deleteStatusPageMutation = useMutation(
    trpc.page.delete.mutationOptions({
      onSuccess: () => {
        router.push("/status-pages");
        // NOTE: invalidate workspace to update the usage
        queryClient.invalidateQueries({
          queryKey: trpc.workspace.get.queryKey(),
        });
        // NOTE: invalidate status page list to update the usage
        queryClient.invalidateQueries({
          queryKey: trpc.page.list.queryKey(),
        });
      },
    }),
  );

  const updateLinksMutation = useMutation(
    trpc.page.updateLinks.mutationOptions({
      onSuccess: () => refetch(),
    }),
  );

  if (!statusPage || !monitors || !workspace) return null;

  return (
    <FormCardGroup>
      <Note color="warning">
        <Info />
        <p className="text-sm">
          Looking to connect monitors to your status page? The setup now has a
          separate components page{" "}
          <Link href={`/status-pages/${id}/components`}>components</Link>.
        </p>
      </Note>
      <FormGeneral
        defaultValues={{
          title: statusPage.title,
          slug: statusPage.slug,
          description: statusPage.description,
          icon: statusPage.icon ?? undefined,
        }}
        onSubmit={async (values) => {
          await updateStatusPageMutation.mutateAsync({
            id: Number.parseInt(id),
            title: values.title,
            slug: values.slug,
            description: values.description ?? "",
            icon: values.icon ?? "",
          });
        }}
      />
      <FormCustomDomain
        locked={workspace.limits["custom-domain"] === false}
        defaultValues={{
          domain: statusPage.customDomain ?? undefined,
        }}
        onSubmit={async (values) => {
          await updateCustomDomainMutation.mutateAsync({
            id: Number.parseInt(id),
            customDomain: values.domain,
          });
        }}
      />
      <FormLinks
        defaultValues={{
          homepageUrl: statusPage.homepageUrl ?? "",
          contactUrl: statusPage.contactUrl ?? "",
        }}
        onSubmit={async (values) => {
          await updateLinksMutation.mutateAsync({
            id: Number.parseInt(id),
            homepageUrl: values.homepageUrl ?? undefined,
            contactUrl: values.contactUrl ?? undefined,
          });
        }}
      />
      <FormAppearance
        defaultValues={{
          forceTheme: statusPage.forceTheme ?? "system",
          configuration: {
            theme: statusPage.configuration?.theme ?? "default",
          },
        }}
        onSubmit={async (values) => {
          await updatePageAppearanceMutation.mutateAsync({
            id: Number.parseInt(id),
            forceTheme: values.forceTheme,
            configuration: values.configuration,
          });
        }}
      />
      <FormPageAccess
        lockedMap={
          new Map([
            ["public", false],
            ["password", workspace.limits["password-protection"] === false],
            [
              "email-domain",
              workspace.limits["email-domain-protection"] === false,
            ],
          ])
        }
        defaultValues={{
          accessType: statusPage.accessType,
          password: statusPage.password ?? undefined,
          authEmailDomains: statusPage.authEmailDomains ?? [],
        }}
        onSubmit={async (values) => {
          await updatePasswordProtectionMutation.mutateAsync({
            id: Number.parseInt(id),
            accessType: values.accessType,
            password: values.password,
            authEmailDomains: values.authEmailDomains,
          });
        }}
      />
      <FormDangerZone
        title={statusPage.title}
        onSubmit={async () => {
          await deleteStatusPageMutation.mutateAsync({
            id: Number.parseInt(id),
          });
        }}
      />
    </FormCardGroup>
  );
}
