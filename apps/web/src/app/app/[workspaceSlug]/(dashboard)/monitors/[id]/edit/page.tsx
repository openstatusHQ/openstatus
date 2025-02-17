import { MonitorForm } from "@/components/forms/monitor/form";
import { api } from "@/trpc/server";
import { searchParamsCache } from "./search-params";

export default async function EditPage(props: {
  params: Promise<{ workspaceSlug: string; id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const id = Number(params.id);
  const monitor = await api.monitor.getMonitorById.query({ id });
  const workspace = await api.workspace.getWorkspace.query();

  const monitorNotifications =
    await api.monitor.getAllNotificationsForMonitor.query({ id });

  const notifications =
    await api.notification.getNotificationsByWorkspace.query();

  const pages = await api.page.getPagesByWorkspace.query();

  const tags = await api.monitorTag.getMonitorTagsByWorkspace.query();

  const { section } = searchParamsCache.parse(searchParams);

  return (
    <MonitorForm
      defaultSection={section}
      defaultValues={{
        ...monitor,
        // FIXME - Why is this not working?
        degradedAfter: monitor.degradedAfter ?? undefined,
        pages: pages
          .filter((page) =>
            page.monitorsToPages.map(({ monitorId }) => monitorId).includes(id),
          )
          .map(({ id }) => id),
        notifications: monitorNotifications?.map(({ id }) => id),
        tags: tags
          .filter((tag) =>
            tag.monitor.map(({ monitorId }) => monitorId).includes(id),
          )
          .map(({ id }) => id),
      }}
      limits={workspace.limits}
      notifications={notifications}
      tags={tags}
      pages={pages}
      plan={workspace.plan}
    />
  );
}
