import Link from "next/link";
import { notFound } from "next/navigation";
import * as z from "zod";

import { Header } from "@/components/dashboard/header";
import { MonitorForm } from "@/components/forms/montitor-form";
import { StatusPageForm } from "@/components/forms/status-page-form";
import { Button } from "@/components/ui/button";
import { api } from "@/trpc/server";
import { Description } from "./_components/description";

/**
 * allowed URL search params
 */
const searchParamsSchema = z.object({
  id: z.coerce.number().optional(), // monitorId
  workspaceSlug: z.string().optional(),
});

export default async function Onboarding({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const search = searchParamsSchema.safeParse(searchParams);

  if (!search.success) {
    return notFound();
  }

  const { workspaceSlug, id: monitorId } = search.data;

  if (!workspaceSlug) {
    return "Waiting for Slug";
  }

  const allMonitors = await api.monitor.getMonitorsByWorkspace.query({
    workspaceSlug,
  });

  if (!monitorId) {
    return (
      <div className="grid gap-6 md:grid-cols-3 md:gap-8">
        <Header
          title="Get Started"
          description="Create your first monitor."
          actions={
            <Button variant="link" className="text-muted-foreground">
              <Link href={`/app`}>Skip</Link>
            </Button>
          }
        />
        <div className="md:col-span-2">
          <MonitorForm {...{ workspaceSlug }} />
        </div>
        <div className="hidden h-full md:col-span-1 md:block">
          <Description step="monitor" />
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-3 md:gap-8">
      <Header
        title="Get Started"
        description="Create your first status page."
        actions={
          <Button variant="link" className="text-muted-foreground">
            <Link href={`/app`}>Skip</Link>
          </Button>
        }
      />
      <div className="md:col-span-2">
        <StatusPageForm
          {...{ workspaceSlug, allMonitors }}
          nextUrl={`/app/${workspaceSlug}/status-pages`}
          checkAllMonitors
        />
      </div>
      <div className="hidden h-full md:col-span-1 md:block">
        <Description step="status-page" />
      </div>
    </div>
  );
}
