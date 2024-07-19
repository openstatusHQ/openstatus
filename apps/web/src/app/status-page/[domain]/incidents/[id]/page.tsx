import { redirect } from "next/navigation";

export default async function IncidentPage({
  params,
}: {
  params: { domain: string; id: string };
}) {
  redirect(`../feed/report/${params.id}`);
}
