import type { ReactNode } from "react";

import { Header } from "@/components/dashboard/header";
import AppPageLayout from "@/components/layout/app-page-layout";
import { Button } from "@openstatus/ui";
import { ArrowUpRight } from "lucide-react";

export default async function Layout({ children }: { children: ReactNode }) {
  return (
    <AppPageLayout>
      <Header
        title="Single Checks"
        description="Built custom CI/CD pipelines with OpenStatus API. Access your checks within the table."
        actions={
          <Button asChild>
            <a
              href="https://docs.openstatus.dev/api-reference/check/post-check"
              target="_blank"
              rel="noreferrer"
              className="whitespace-nowrap"
            >
              API Docs <ArrowUpRight className="ml-1 h-4 w-4" />
            </a>
          </Button>
        }
      />
      {children}
    </AppPageLayout>
  );
}
