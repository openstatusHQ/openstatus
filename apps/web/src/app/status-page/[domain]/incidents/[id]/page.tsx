import { redirect } from "next/navigation";

export default async function IncidentPage(props: {
  params: Promise<{ domain: string; id: string }>;
}) {
  const params = await props.params;
  redirect(`../events/report/${params.id}`);
}
