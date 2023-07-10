import * as React from "react";

import { Container } from "@/components/dashboard/container";
import { Header } from "@/components/dashboard/header";
import { wait } from "@/lib/utils";

export default async function EndpointPage() {
  await wait(1000);
  return (
    <div className="grid gap-6 md:grid-cols-2 md:gap-8">
      <Header title="Endpoint" description="Overview of all your sites." />
      <Container title="Hello"></Container>
      <Container title="World"></Container>
    </div>
  );
}
