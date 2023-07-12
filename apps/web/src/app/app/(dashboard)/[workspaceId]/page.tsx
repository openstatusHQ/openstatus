import * as React from "react";

import { Container } from "@/components/dashboard/container";
import { Header } from "@/components/dashboard/header";
import { DialogForm } from "@/components/forms/dialog-form";
import { Button } from "@/components/ui/button";
import { wait } from "@/lib/utils";
import { api } from "@/trpc/server";
import Loading from "./loading";

export default async function DashboardPage() {
  const workspace = await api.workspace.getUserWithWorkspace.query();
  if (!workspace) {
    return <Loading />;
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 md:gap-8">
      <div className="col-span-full flex w-full justify-between">
        <Header title="Dashboard" description="Overview of all your websites">
          {/* <Button>Create</Button> */}
          <DialogForm />
        </Header>
      </div>
      <Container title="Hello"></Container>
      <Container title="World"></Container>
    </div>
  );
}
