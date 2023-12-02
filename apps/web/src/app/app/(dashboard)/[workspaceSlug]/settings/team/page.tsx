import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@openstatus/ui";

import { columns } from "@/components/data-table/user/columns";
import { DataTable } from "@/components/data-table/user/data-table";
import { api } from "@/trpc/server";

export default async function TeamPage() {
  const workspace = await api.workspace.getWorkspace.query();
  const users = await api.workspace.getWorkspaceUsers.query();

  console.log(users);

  return (
    <div className="flex flex-col gap-4">
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Team</AlertTitle>
        <AlertDescription>
          {workspace.plan === "free"
            ? "Please upgrade to invite more team members."
            : "Please contact us to invite more team members. We are working on a self-service solution."}
        </AlertDescription>
      </Alert>
      <DataTable data={users} columns={columns} />
    </div>
  );
}
