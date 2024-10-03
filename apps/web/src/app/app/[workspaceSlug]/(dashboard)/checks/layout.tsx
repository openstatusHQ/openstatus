import type { ReactNode } from "react";

import { Header } from "@/components/dashboard/header";
import AppPageLayout from "@/components/layout/app-page-layout";

export default async function Layout({ children }: { children: ReactNode }) {
  return (
    <AppPageLayout>
      <Header
        title="Single Checks"
        description="Access your CI/API checks within the table."
      />
      {children}
    </AppPageLayout>
  );
}
