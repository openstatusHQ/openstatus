import type { WorkspacePlan } from "@openstatus/plans";

import { Shell } from "@/components/dashboard/shell";
import { Footer } from "../_components/footer";
import { PasswordForm } from "../_components/password-form";

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
        <Shell className="mx-auto grid gap-6">
          <h1 className="text-2xl font-semibold">Protected Page</h1>
          <PasswordForm slug={slug} />
        </Shell>
      </main>
      <Footer plan={plan} />
    </div>
  );
}
