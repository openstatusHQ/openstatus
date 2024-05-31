import * as React from "react";

import { PathCard } from "./_components/path-card";
import { api } from "@/trpc/server";

export default async function RUMPage() {
  const applications = await api.workspace.getApplicationWorkspaces.query();
  if (applications.length === 0 || !applications[0].dsn) {
    return null;
  }

  return (
    <>
      <PathCard dsn={applications[0].dsn} />
    </>
  );
}
