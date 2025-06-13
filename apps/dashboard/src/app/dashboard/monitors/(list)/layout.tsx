import {
  AppHeader,
  AppHeaderActions,
  AppHeaderContent,
} from "@/components/nav/app-header";
import { Breadcrumb } from "./breadcrumb";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { AppSidebarTrigger } from "@/components/nav/app-sidebar";

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
            <Link href="/dashboard/monitors/create">Create Monitor</Link>
          </Button>
        </AppHeaderActions>
      </AppHeader>
      <main className="w-full flex-1">{children}</main>
    </div>
  );
}
