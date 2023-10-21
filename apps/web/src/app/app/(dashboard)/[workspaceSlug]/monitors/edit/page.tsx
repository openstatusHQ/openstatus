import { notFound } from "next/navigation";
import * as z from "zod";

import { Header } from "@/components/dashboard/header";
import { MonitorForm } from "@/components/forms/monitor-form";
import { api } from "@/trpc/server";

/**
 * allowed URL search params
 */
const searchParamsSchema = z.object({
  id: z.coerce.number().optional(),
});

export default async function EditPage({
  params,
  searchParams,
}: {
  params: { workspaceSlug: string };
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const search = searchParamsSchema.safeParse(searchParams);

  if (!search.success) {
    return notFound();
  }

  const { id } = search.data;
  const { workspaceSlug } = params;

  const monitor = id && (await api.monitor.getMonitorByID.query({ id }));
  const workspace = await api.workspace.getWorkspace.query({
    slug: workspaceSlug,
  });

  const monitorNotifications = id
    ? await api.monitor.getAllNotificationsForMonitor.query({
        id,
      })
    : [];

  const notifications =
    await api.notification.getNotificationsByWorkspace.query({
      workspaceSlug,
    });

  return (
    <div className="grid gap-6 md:grid-cols-2 md:gap-8">
      <Header
        title="Monitor"
        description={monitor ? "Update your monitor" : "Create your monitor"}
      />
      <div className="col-span-full">
        <MonitorForm
          defaultValues={
            monitor
              ? {
                  ...monitor,
                  notifications: monitorNotifications?.map(({ id }) => id),
                }
              : undefined
          }
          plan={workspace?.plan}
          {...{ workspaceSlug, notifications }}
        />
      </div>
    </div>
  );
}
