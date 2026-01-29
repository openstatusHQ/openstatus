"use client";

import { FormComponents } from "@/components/forms/components/form-components";
import { useTRPC } from "@/lib/trpc/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { FormCardGroup } from "../form-card";
import { FormConfiguration } from "../status-page/form-configuration";

export function FormComponentsUpdate() {
  const { id } = useParams<{ id: string }>();
  const trpc = useTRPC();
  const { data: statusPage, refetch } = useQuery(
    trpc.page.get.queryOptions({ id: Number.parseInt(id) }),
  );
  const { data: pageComponents, refetch: refetchComponents } = useQuery(
    trpc.pageComponent.list.queryOptions({ pageId: Number.parseInt(id) }),
  );
  const { data: monitors } = useQuery(trpc.monitor.list.queryOptions());

  const updateComponentsMutation = useMutation(
    trpc.pageComponent.updateOrder.mutationOptions({
      onSuccess: () => {
        refetch();
        refetchComponents();
      },
    }),
  );

  const updatePageConfigurationMutation = useMutation(
    trpc.page.updatePageConfiguration.mutationOptions({
      onSuccess: () => refetch(),
    }),
  );

  if (!statusPage || !pageComponents || !monitors) return null;

  // Separate standalone components from grouped components
  const standaloneComponents = pageComponents.filter((c) => !c.groupId);
  const groupedComponents = pageComponents.filter((c) => c.groupId);

  // Build groups from pageComponentGroups
  const groups = statusPage.pageComponentGroups.map((group) => {
    const componentsInGroup = groupedComponents.filter(
      (c) => c.groupId === group.id,
    );
    // Find the order of the group (use the first component's order)
    const firstComponent = componentsInGroup[0];
    return {
      id: group.id,
      order: firstComponent?.order ?? 0,
      name: group.name,
      components: componentsInGroup.map((c) => ({
        id: c.id,
        monitorId: c.monitorId,
        order: c.groupOrder ?? 0,
        name: c.name,
        description: c.description ?? "",
        type: c.type,
      })),
    };
  });

  // Build default values for the form
  const defaultValues = {
    components: standaloneComponents.map((c) => ({
      id: c.id,
      monitorId: c.monitorId,
      order: c.order ?? 0,
      name: c.name,
      description: c.description ?? "",
      type: c.type,
    })),
    groups,
  };

  const configLink = `https://${
    statusPage.slug
  }.stpg.dev?configuration-token=${statusPage.createdAt?.getTime().toString()}`;

  return (
    <FormCardGroup>
      <FormComponents
        pageComponents={standaloneComponents}
        monitors={monitors}
        allPageComponents={pageComponents}
        defaultValues={defaultValues}
        legacy={statusPage.legacyPage}
        onSubmit={async (values) => {
          await updateComponentsMutation.mutateAsync({
            pageId: Number.parseInt(id),
            components: values.components.map(({ id, ...rest }) => rest),
            groups: values.groups.map(({ id, components, ...rest }) => ({
              ...rest,
              components: components.map(({ id, ...c }) => c),
            })),
          });
        }}
      />
      <FormConfiguration
        defaultValues={{
          configuration: statusPage.configuration ?? {},
        }}
        onSubmit={async (values) => {
          await updatePageConfigurationMutation.mutateAsync({
            id: Number.parseInt(id),
            configuration: {
              uptime:
                typeof values.configuration.uptime === "boolean"
                  ? values.configuration.uptime
                  : values.configuration.uptime === "true",
              value: values.configuration.value ?? "duration",
              type: values.configuration.type ?? "absolute",
              theme: values.configuration.theme ?? undefined,
            },
          });
        }}
        configLink={configLink}
      />
    </FormCardGroup>
  );
}
