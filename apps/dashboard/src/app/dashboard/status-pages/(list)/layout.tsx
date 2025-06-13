import {
  AppHeader,
  AppHeaderActions,
  AppHeaderContent,
} from "@/components/nav/app-header";
import { AppSidebarTrigger } from "@/components/nav/app-sidebar";

import { Breadcrumb } from "./breadcrumb";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <AppHeader>
        <AppHeaderContent>
          <AppSidebarTrigger />
          <Breadcrumb />
        </AppHeaderContent>
        <AppHeaderActions>
          <Button size="sm" asChild>
            <Link href="/dashboard/status-pages/create">
              Create Status Page
            </Link>
          </Button>
        </AppHeaderActions>
      </AppHeader>
      <main className="w-full flex-1">{children}</main>
    </div>
  );
}
