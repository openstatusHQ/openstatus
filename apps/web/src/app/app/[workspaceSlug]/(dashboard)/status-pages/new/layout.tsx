import { Header } from "@/components/dashboard/header";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-6 md:grid-cols-2 md:gap-8">
      <Header title="Pages" description="Create your page." />
      <div className="col-span-full">{children}</div>
    </div>
  );
}
