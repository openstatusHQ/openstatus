import * as React from "react";

import { api } from "@/trpc/server";
import { PathCard } from "./_components/path-card";
import { SessionTable } from "./_components/session-table";
import { searchParamsCache } from "./search-params";

export default async function RUMPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const { path } = searchParamsCache.parse(searchParams);

  const applications = await api.workspace.getApplicationWorkspaces.query();
  const dsn = applications?.[0]?.dsn;

  if (!path || !dsn) return null;

  return (
    <>
      <PathCard dsn={dsn} path={path} />
      <div>
        <SessionTable dsn={dsn} path={path} />
      </div>
    </>
  );
}
