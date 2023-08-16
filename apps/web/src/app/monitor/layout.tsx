import * as React from "react";

import { Shell } from "@/components/dashboard/shell";
import { BackButton } from "@/components/layout/back-button";
import { MarketingLayout } from "@/components/layout/marketing-layout";

// same layout as /play
export default function MonitorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MarketingLayout>
      <BackButton href="/play" />
      <Shell>{children}</Shell>
    </MarketingLayout>
  );
}
