import { Header } from "@/components/dashboard/header";
import AppPageLayout from "@/components/layout/app-page-layout";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppPageLayout>
      <Header title="Notifications" description="Create your notification" />
      {children}
    </AppPageLayout>
  );
}
