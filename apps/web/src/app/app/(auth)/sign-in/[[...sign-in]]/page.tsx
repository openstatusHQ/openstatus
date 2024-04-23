import Link from "next/link";

import { Shell } from "@/components/dashboard/shell";
import { OauthButtons } from "../../_components/oauth-buttons";
import { TermsAndConditions } from "../../_components/terms-and-conditions";

export default function Page() {
  return (
    <Shell className="my-4 grid w-full max-w-xl gap-6 md:p-10">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-muted-foreground text-sm">
          Create an account?{" "}
          <Link
            href="/app/sign-up"
            className="text-primary underline underline-offset-4 hover:no-underline"
          >
            Sign up
          </Link>
        </p>
      </div>
      <OauthButtons type={"sign-in"} />
      <TermsAndConditions />
    </Shell>
  );
}
