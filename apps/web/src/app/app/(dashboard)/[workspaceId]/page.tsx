import * as React from "react";
import { auth, currentUser } from "@clerk/nextjs";

import { Header } from "@/components/header";

export default async function AppPage() {
  const user = await currentUser();
  console.log({ user });
  return (
    <div>
      <Header title="App" description="Overview of all your websites" />
    </div>
  );
}
