import { FormCardGroup } from "@/components/forms/form-card";
import { FormCustomDomain } from "./form-custom-domain";
import { FormDangerZone } from "./form-danger-zone";
import { FormGeneral } from "./form-general";
import { FormMonitors } from "./form-monitors";
import { FormPasswordProtection } from "./form-password-protection";
import { useParams, useRouter } from "next/navigation";
import { useTRPC } from "@/lib/trpc/client";
import { useMutation, useQuery } from "@tanstack/react-query";

export function FormStatusPageUpdate() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const trpc = useTRPC();
  const { data: statusPage, refetch } = useQuery(
    trpc.page.get.queryOptions({ id: parseInt(id) })
  );
  const { data: monitors } = useQuery(trpc.monitor.list.queryOptions());
  const updateStatusPageMutation = useMutation(
    trpc.page.updateGeneral.mutationOptions({
      onSuccess: () => refetch(),
    })
  );

  const updatePasswordProtectionMutation = useMutation(
    trpc.page.updatePasswordProtection.mutationOptions({
      onSuccess: () => refetch(),
    })
  );

  const updateMonitorsMutation = useMutation(
    trpc.page.updateMonitors.mutationOptions({
      onSuccess: () => refetch(),
    })
  );

  const deleteStatusPageMutation = useMutation(
    trpc.page.delete.mutationOptions({
      onSuccess: () => router.push("/status-pages"),
    })
  );

  if (!statusPage || !monitors) return null;

  return (
    <FormCardGroup>
      <FormGeneral
        defaultValues={{
          title: statusPage.title,
          slug: statusPage.slug,
          description: statusPage.description,
          icon: statusPage.icon ?? undefined,
        }}
        onSubmit={async (values) => {
          await updateStatusPageMutation.mutateAsync({
            id: parseInt(id),
            title: values.title,
            slug: values.slug,
            description: values.description ?? "",
            icon: values.icon ?? "",
          });
        }}
      />
      <FormMonitors
        monitors={monitors ?? []}
        defaultValues={{
          monitors: statusPage.monitors.map((monitor) => ({
            id: monitor.id,
            order: monitor.order,
            // type: monitor.type,
            type: "none" as const,
          })),
        }}
        onSubmit={async (values) => {
          await updateMonitorsMutation.mutateAsync({
            id: parseInt(id),
            monitors: values.monitors,
          });
        }}
      />
      <FormCustomDomain />
      <FormPasswordProtection
        defaultValues={{
          passwordProtected: statusPage.passwordProtected ?? false,
          password: statusPage.password ?? undefined,
        }}
        onSubmit={async (values) => {
          await updatePasswordProtectionMutation.mutateAsync({
            id: parseInt(id),
            passwordProtected: values.passwordProtected ?? false,
            password: values.password,
          });
        }}
      />
      <FormDangerZone
        onSubmit={async () => {
          await deleteStatusPageMutation.mutateAsync({
            id: parseInt(id),
          });
        }}
      />
    </FormCardGroup>
  );
}
