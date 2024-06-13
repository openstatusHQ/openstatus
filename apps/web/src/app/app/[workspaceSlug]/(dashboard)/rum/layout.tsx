import { Header } from "@/components/dashboard/header";
import AppPageLayout from "@/components/layout/app-page-layout";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppPageLayout>
      <Header
        title="Real User Monitoring"
        description="Get speed insights for your application."
      />
      {children}
    </AppPageLayout>
  );
}
