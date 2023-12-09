import { Header } from "@/components/dashboard/header";
import { Navbar } from "@/components/dashboard/navbar";

export default function SettingsLayout({
  params,
  children,
}: {
  params: { workspaceSlug: string };
  children: React.ReactNode;
}) {
  const navigation = [
    {
      label: "General",
      href: `/app/${params.workspaceSlug}/settings/general`,
      segment: "general",
    },
    {
      label: "Team",
      href: `/app/${params.workspaceSlug}/settings/team`,
      segment: "team",
    },
    {
      label: "API Token",
      href: `/app/${params.workspaceSlug}/settings/api-token`,
      segment: "api-token",
    },
    {
      label: "Billing",
      href: `/app/${params.workspaceSlug}/settings/billing`,
      segment: "billing",
    },
    {
      label: "Appearance",
      href: `/app/${params.workspaceSlug}/settings/appearance`,
      segment: "appearance",
    },
  ];

  return (
    <div className="grid gap-6 md:grid-cols-2 md:gap-8">
      <Header
        title="Settings"
        description="Your OpenStatus workspace settings."
      />
      <Navbar className="col-span-full" {...{ navigation }} />
      <div className="col-span-full">{children}</div>
    </div>
  );
}
