import { Skeleton } from "@openstatus/ui/components/ui/skeleton";

import {
  Section,
  SectionGroup,
  SectionHeader,
} from "@/components/content/section";
import { AppHeader, AppHeaderContent } from "@/components/nav/app-header";
import { AppSidebarTrigger } from "@/components/nav/app-sidebar";
import { DataTableSkeleton } from "@/components/ui/data-table/data-table-skeleton";

/** Route-level fallback for `loading.tsx`; mirrors the AppHeader + Section shell. */
export function PageSkeleton() {
  return (
    <div>
      <AppHeader>
        <AppHeaderContent>
          <AppSidebarTrigger />
          <Skeleton className="h-4 w-32" />
        </AppHeaderContent>
      </AppHeader>
      <main className="w-full flex-1">
        <SectionGroup>
          <Section>
            <SectionHeader>
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-64" />
            </SectionHeader>
            <DataTableSkeleton />
          </Section>
        </SectionGroup>
      </main>
    </div>
  );
}
