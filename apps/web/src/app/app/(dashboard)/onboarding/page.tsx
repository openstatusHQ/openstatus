import Link from "next/link";
import { notFound } from "next/navigation";
import * as z from "zod";

import { Button } from "@openstatus/ui";

import { Header } from "@/components/dashboard/header";
import { MonitorForm } from "@/components/forms/montitor-form";
import { StatusPageForm } from "@/components/forms/status-page-form";
import { api } from "@/trpc/server";
import { Description } from "./_components/description";
import { Path } from "./_components/path";

/**
 * allowed URL search params
 */
const searchParamsSchema = z.object({
  path: z.string().optional(), // "vercel" | "http"
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

  // Instead of having the workspaceSlug in the search params, we can get it from the auth user
  const { workspaceSlug, id: monitorId, path } = search.data;

  if (!workspaceSlug) {
    return "Waiting for Slug";
  }

  if (!path) {
    return (
      <div className="flex h-full w-full flex-col gap-6 md:gap-8">
        <Header
          title="Get Started"
          description="Create your first status page."
          actions={
            <Button variant="link" className="text-muted-foreground">
              <Link href={`/app/${workspaceSlug}/monitors`}>Skip</Link>
            </Button>
          }
        />
        <div className="grid h-full w-full gap-6 md:grid-cols-3 md:gap-8">
          <div className="md:col-span-2">
            <Path />
          </div>
          <div className="hidden h-full md:col-span-1 md:block">
            <Description />
          </div>
        </div>
      </div>
    );
  }

  const allMonitors = await api.monitor.getMonitorsByWorkspace.query({
    workspaceSlug,
  });

  if (!monitorId) {
    return (
      <div className="flex h-full w-full flex-col gap-6 md:gap-8">
        <Header
          title="Get Started"
          description="Create your first monitor."
          actions={
            <Button variant="link" className="text-muted-foreground">
              <Link href={`/app/${workspaceSlug}/monitors`}>Skip</Link>
            </Button>
          }
        />
        <div className="grid h-full w-full gap-6 md:grid-cols-3 md:gap-8">
          <div className="md:col-span-2">
            <MonitorForm {...{ workspaceSlug }} />
          </div>
          <div className="hidden h-full md:col-span-1 md:block">
            <Description step="monitor" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col gap-6 md:gap-8">
      <Header
        title="Get Started"
        description="Create your first status page."
        actions={
          <Button variant="link" className="text-muted-foreground">
            <Link href={`/app/${workspaceSlug}/monitors`}>Skip</Link>
          </Button>
        }
      />
      <div className="grid h-full w-full gap-6 md:grid-cols-3 md:gap-8">
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
    </div>
  );
}
