import { HydrateClient } from "@/lib/trpc/server";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <HydrateClient>{children}</HydrateClient>;
}
