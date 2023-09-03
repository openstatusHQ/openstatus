import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createLogDrain, getLogDrains } from "./client";
import { decrypt } from "./utils";

export async function Configure() {
  const iv = cookies().get("iv")?.value;
  const encryptedToken = cookies().get("token")?.value;
  const teamId = cookies().get("teamId")?.value;

  if (!iv || !encryptedToken) {
    /** Redirect to access new token */
    return redirect("./callback");
  }

  const token = decrypt(
    Buffer.from(iv, "base64url"),
    Buffer.from(encryptedToken, "base64url"),
  ).toString();

  const logDrains = await getLogDrains(token, teamId);

  async function create(formData: FormData) {
    "use server";
    await createLogDrain(
      token,
      // @ts-expect-error We need more data - but this is a demo
      {
        deliveryFormat: "json",
        name: "OpenStatus Log Drain",
        // TODO: update with correct url
        url: "https://f97b-2003-ec-e716-2900-cab-5249-1843-c87b.ngrok-free.app/api/integrations/vercel",
        sources: [
          "static",
          "lambda",
          "build",
          "edge",
          "external",
          "deployment",
        ],
      },
      teamId,
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center">
      <div className="border-border m-3 grid w-full max-w-xl gap-3 rounded-lg border p-6">
        <h1 className="font-cal text-2xl">Configure</h1>
        <form action={create}>
          <button className="bg-foreground text-background rounded-md px-2 py-1">
            Install Log Drain
          </button>
        </form>
        <ul>
          {logDrains.map((item) => (
            <li key={item.id}>{item.name}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
