import { notFound } from "next/navigation";
import * as z from "zod";

import { Header } from "@/components/dashboard/header";
import { NotificationForm } from "@/components/forms/notification-form";
import { api } from "@/trpc/server";

/**
 * allowed URL search params
 */
const searchParamsSchema = z.object({
  id: z.coerce.number().optional(),
});

export default async function EditPage({
  searchParams,
}: {
  params: { workspaceSlug: string };
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const search = searchParamsSchema.safeParse(searchParams);

  if (!search.success) {
    return notFound();
  }
  const workspace = await api.workspace.getWorkspace.query();

  const { id } = search.data;

  const notification = id
    ? await api.notification.getNotificationById.query({ id })
    : undefined;

  return (
    <div className="grid gap-6 md:grid-cols-2 md:gap-8">
      <Header
        title="Notification"
        description={
          notification
            ? "Update your notification channel"
            : "Create your notification channel"
        }
      />
      <div className="col-span-full">
        <NotificationForm
          defaultValues={notification}
          workspacePlan={workspace.plan}
        />
      </div>
    </div>
  );
}
