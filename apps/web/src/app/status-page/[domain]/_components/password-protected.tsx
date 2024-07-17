import type { WorkspacePlan } from "@openstatus/db/src/schema/workspaces/validation";

import { Shell } from "@/components/dashboard/shell";
import { Footer } from "../_components/footer";
import { PasswordFormSuspense } from "../_components/password-form";

export default function PasswordProtected({
  slug,
  plan,
}: {
  slug: string;
  plan: WorkspacePlan;
}) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col space-y-6 p-4 md:p-8">
      <main className="flex h-full w-full flex-1 flex-col justify-center">
        <Shell className="mx-auto grid max-w-xl gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-center font-semibold text-3xl tracking-tight">
              Protected Page
            </h1>
            <p className="text-center text-muted-foreground text-sm">
              Enter the password to access the status page.
            </p>
            <PasswordFormSuspense slug={slug} />
          </div>
        </Shell>
      </main>
      <Footer plan={plan} />
    </div>
  );
}
