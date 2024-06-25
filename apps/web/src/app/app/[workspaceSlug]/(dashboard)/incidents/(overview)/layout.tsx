import type { ReactNode } from "react";

import { Header } from "@/components/dashboard/header";
import AppPageLayout from "@/components/layout/app-page-layout";

export default async function Layout({ children }: { children: ReactNode }) {
  return (
    <AppPageLayout>
      <Header
        title="Incidents"
        description="Overview of all your incidents."
        actions={undefined}
      />
      {children}
    </AppPageLayout>
  );
}
