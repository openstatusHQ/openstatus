import { redirect } from "next/navigation";

export default async function Page(props: {
  params: Promise<{ workspaceSlug: string; id: string }>;
}) {
  const params = await props.params;
  return redirect(`./${params.id}/overview`);
}
