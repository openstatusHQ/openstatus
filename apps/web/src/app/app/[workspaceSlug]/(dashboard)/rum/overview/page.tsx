import * as React from "react";

import { PathCard } from "./_components/path-card";
import { api } from "@/trpc/server";
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
  const search = searchParamsSchema.safeParse(searchParams);

  const applications = await api.workspace.getApplicationWorkspaces.query();
  const dsn = applications?.[0]?.dsn;

  if (!search.success || !dsn) return null;

  return (
    <>
      <PathCard dsn={dsn} path={search.data.path} />
      <div>
        <SessionTable dsn={dsn} path={search.data.path} />
      </div>
    </>
  );
}
