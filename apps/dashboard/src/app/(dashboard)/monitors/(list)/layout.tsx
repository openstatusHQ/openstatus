import {
  AppHeader,
  AppHeaderActions,
  AppHeaderContent,
} from "@/components/nav/app-header";
import { AppSidebarTrigger } from "@/components/nav/app-sidebar";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Breadcrumb } from "./breadcrumb";

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
            <Link href="/monitors/create">Create Monitor</Link>
          </Button>
        </AppHeaderActions>
      </AppHeader>
      <main className="w-full flex-1">{children}</main>
    </div>
  );
}
