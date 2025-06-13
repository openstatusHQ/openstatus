import { AppHeader, AppHeaderContent } from "@/components/nav/app-header";
import { Breadcrumb } from "./breadcrumb";
import { AppSidebarTrigger } from "@/components/nav/app-sidebar";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <AppHeader>
        <AppHeaderContent>
          <AppSidebarTrigger />
          <Breadcrumb />
        </AppHeaderContent>
      </AppHeader>
      <main className="flex-1 w-full">{children}</main>
    </div>
  );
}
