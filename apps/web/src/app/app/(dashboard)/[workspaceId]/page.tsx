import * as React from "react";

import { Container } from "@/components/dashboard/container";
import { Header } from "@/components/dashboard/header";
import { DialogForm } from "@/components/forms/dialog-form";
import { Button } from "@/components/ui/button";
import { wait } from "@/lib/utils";

export default async function DashboardPage() {
  await wait(1000);
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
