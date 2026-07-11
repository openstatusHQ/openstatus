"use client";

import type { PageConfiguration } from "@openstatus/db/src/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useState } from "react";

import { FormComponents } from "@/components/forms/components/form-components";
import { useTRPC } from "@/lib/trpc/client";

import { FormCardGroup } from "../form-card";
import { FormConfiguration } from "../status-page/form-configuration";
import { FormImport, type ImportFormValues } from "./form-import";

export function FormComponentsUpdate() {
  const { id } = useParams<{ id: string }>();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [formKey, setFormKey] = useState(0);
  const { data: statusPage, refetch } = useQuery(
    trpc.page.get.queryOptions({ id: Number.parseInt(id) }),
  );
  const { data: pageComponents, refetch: refetchComponents } = useQuery(
    trpc.pageComponent.list.queryOptions({ pageId: Number.parseInt(id) }),
  );
  const { data: monitors, refetch: refetchMonitors } = useQuery(
    trpc.monitor.list.queryOptions(),
  );
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());

  // Remount the form after save. Newly-added components/groups get
  // `Date.now()` placeholder ids (see `form-components.tsx`). The
  // server returns real ids, but RHF only reads `defaultValues` on
  // mount — without a remount the next save would round-trip the
  // placeholders, causing the server's diff to treat real rows as
  // "removed" (delete) and placeholders as "new" (create).
  const refetchAndRemount = async (...refetches: Promise<unknown>[]) => {
    await Promise.all(refetches);
    // invalidate workspace to update the usage (getting-started checklist)
    queryClient.invalidateQueries({
      queryKey: trpc.workspace.get.queryKey(),
    });
    setFormKey((k) => k + 1);
  };

  const updateComponentsMutation = useMutation(
    trpc.pageComponent.updateOrder.mutationOptions({
      onSuccess: () => refetchAndRemount(refetch(), refetchComponents()),
    }),
  );

  const updatePageConfigurationMutation = useMutation(
    trpc.page.updatePageConfiguration.mutationOptions({
      onSuccess: () => refetch(),
    }),
  );

  const importMutation = useMutation(
    trpc.import.run.mutationOptions({
      onSuccess: () =>
        refetchAndRemount(refetch(), refetchComponents(), refetchMonitors()),
    }),
  );

  if (!statusPage || !pageComponents || !monitors || !workspace) return null;

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
      defaultOpen: group.defaultOpen ?? false,
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
      {/* key forces remount after import so useForm picks up new defaultValues */}
      <FormComponents
        key={formKey}
        pageComponents={standaloneComponents}
        monitors={monitors}
        allPageComponents={pageComponents}
        defaultValues={defaultValues}
        workspace={workspace}
        onSubmit={async (values) => {
          await updateComponentsMutation.mutateAsync({
            pageId: Number.parseInt(id),
            components: values.components,
            groups: values.groups,
          });
        }}
      />
      <FormConfiguration
        hasMonitorComponents={pageComponents.some((c) => c.type === "monitor")}
        defaultValues={{
          configuration: statusPage.configuration ?? {},
        }}
        onSubmit={async (values) => {
          await updatePageConfigurationMutation.mutateAsync({
            id: Number.parseInt(id),
            // `FormConfiguration` keeps its internal values loose
            // (strings from radios/selects). Casts use `PageConfiguration`
            // derived from the service input so the enum members stay in
            // sync with `pageConfigurationSchema` — an invalid submit
            // surfaces as a zod error from the router.
            configuration: {
              uptime:
                typeof values.configuration.uptime === "boolean"
                  ? values.configuration.uptime
                  : values.configuration.uptime === "true",
              value: (values.configuration.value ??
                "duration") as PageConfiguration["value"],
              type: (values.configuration.type ??
                "absolute") as PageConfiguration["type"],
              theme: (values.configuration.theme ??
                undefined) as PageConfiguration["theme"],
              days: (values.configuration.days
                ? Number(values.configuration.days)
                : undefined) as PageConfiguration["days"],
            },
          });
        }}
        configLink={configLink}
      />
      <FormImport
        pageId={statusPage.id}
        onSubmit={async (values: ImportFormValues) => {
          return await importMutation.mutateAsync({
            provider: values.provider,
            apiKey: values.apiKey,
            pageId: statusPage.id,
            statuspagePageId: values.statuspagePageId ?? undefined,
            betterstackStatusPageId:
              values.betterstackStatusPageId ?? undefined,
            instatusPageId: values.instatusPageId ?? undefined,
            checklyAccountId: values.checklyAccountId ?? undefined,
            checklyStatusPageId: values.checklyStatusPageId ?? undefined,
            options: {
              includeStatusReports: values.includeStatusReports,
              includeSubscribers: values.includeSubscribers,
              includeComponents: values.includeComponents,
              includeMonitors: values.includeMonitors,
            },
          });
        }}
      />
    </FormCardGroup>
  );
}
