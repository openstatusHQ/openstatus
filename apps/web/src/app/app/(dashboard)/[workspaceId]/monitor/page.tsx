import * as React from "react";

import { Container } from "@/components/dashboard/container";
import { Header } from "@/components/dashboard/header";
import { wait } from "@/lib/utils";

export default async function MonitorPage() {
  await wait(1000);
  return (
    <div className="grid grid-cols-2 gap-8">
      <Header title="Monitor" description="Overview of all the responses." />
      <Container title="Hello"></Container>
      <Container title="World"></Container>
    </div>
  );
}
