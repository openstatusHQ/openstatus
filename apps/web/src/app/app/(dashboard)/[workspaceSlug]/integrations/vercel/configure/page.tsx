import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SubmitButton } from "@openstatus/vercel/src/components/submit-button";
import {
  createLogDrain,
  deleteLogDrain,
  getLogDrains,
  getProjects,
} from "@openstatus/vercel/src/libs/client";
import { decrypt } from "@openstatus/vercel/src/libs/crypto";

import { api } from "@/trpc/server";

export default async function Configure({
  params,
}: {
  params: { workspaceSlug: string };
}) {
  const iv = cookies().get("iv")?.value;
  const encryptedToken = cookies().get("token")?.value;
  const teamId = cookies().get("teamId")?.value;

  if (!iv || !encryptedToken) {
    console.log('no iv or encryptedToken');
    /** Redirect to access new token */
    return redirect("/app");
  }

  const token = decrypt(
    Buffer.from(iv || "", "base64url"),
    Buffer.from(encryptedToken || "", "base64url"),
  ).toString();

  let logDrains = await getLogDrains(token, teamId);

  const projects = await getProjects(token, teamId);

  for (const project of projects.projects) {
    console.log({ project });
    console.log("create integration");
    console.log(project.id);
    api.integration.createIntegration.mutate({
      workspaceSlug: params.workspaceSlug,
      input: {
        name: "Vercel",
        data: JSON.stringify(project),
        externalId: project.id,
      },
    });
  }
  //  Create integration project if it doesn't exist

  if (logDrains.length === 0) {
    logDrains = [
      await createLogDrain(
        token,
        // @ts-expect-error We need more data - but this is a demo
        {
          deliveryFormat: "json",
          name: "OpenStatus Log Drain",
          url: "https://api.openstatus.dev/integration/vercel",
          sources: ["static", "lambda", "build", "edge", "external"],
          // headers: { "key": "value"}
        },
        teamId,
      ),
    ];
  }

  // TODO: automatically create log drain on installation
  // async function create(formData: FormData) {
  //   "use server";
  //   await createLogDrain(
  //     token,
  //     // @ts-expect-error We need more data - but this is a demo
  //     {
  //       deliveryFormat: "json",
  //       name: "OpenStatus Log Drain",
  //       // TODO: update with correct url
  //       url: "https://6be9-2a0d-3344-2324-1e04-4dc7-d06a-a389-48c0.ngrok-free.app/api/integrations/vercel",
  //       sources: ["static", "lambda", "edge", "external"],
  //       // headers: { "key": "value"}
  //     },
  //     teamId,
  //   );
  //   revalidatePath("/");
  // }

  async function _delete(formData: FormData) {
    "use server";
    const id = formData.get("id")?.toString();
    console.log({ id });
    if (id) {
      await deleteLogDrain(token, id, String(teamId));
      revalidatePath("/");
    }
  }

  return (
    <div className="flex  w-full flex-col items-center justify-center">
      <div className="border-border m-3 grid w-full max-w-xl gap-3 rounded-lg border p-6 backdrop-blur-[2px]">
        <h1 className="font-cal text-2xl">Configure Vercel Integration</h1>
        <ul>
          {logDrains.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-2"
            >
              <p>{item.name}</p>
              <form action={_delete}>
                <input name="id" value={item.id} className="hidden" />
                <SubmitButton>Remove integration</SubmitButton>
              </form>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
