import * as React from "react";

import { Header } from "@/components/dashboard/header";
import { HelpCallout } from "@/components/dashboard/help-callout";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-full grid-cols-1 grid-rows-[auto,1fr,auto] gap-6 md:grid-cols-2 md:gap-8">
      <Header
        title="Incidents"
        description="Overview of all your incidents."
        actions={undefined}
      />
      <div className="col-span-full">{children}</div>
      <div className="mt-8 md:mt-12">
        <HelpCallout />
      </div>
    </div>
  );
}
