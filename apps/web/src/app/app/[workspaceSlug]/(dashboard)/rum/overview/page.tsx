import * as React from "react";

import { PathCard } from "./_components/path-card";
import { api } from "@/trpc/server";
import { Suspense } from "react";
import { Skeleton } from "@openstatus/ui/src/components/skeleton";
import Loading from "../loading";
import { auth } from "@/lib/auth";
import { SessionTable } from "./_components/session-table";
import { z } from "zod";

const searchParamsSchema = z.object({
  path: z.string(),
});

export default async function RUMPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const session = await auth();
  if (!session?.user) {
    return <Loading />;
  }

  const data = searchParamsSchema.parse(searchParams);
  const applications = await api.workspace.getApplicationWorkspaces.query();
  if (applications.length === 0 || !applications[0].dsn) {
    return null;
  }

  return (
    <>
      <PathCard dsn={applications[0].dsn} path={data.path} />
      <div>
        <SessionTable dsn={applications[0].dsn} path={data.path} />
      </div>
    </>
  );
}
