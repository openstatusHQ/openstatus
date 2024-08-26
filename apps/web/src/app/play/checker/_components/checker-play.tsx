import { Shell } from "@/components/dashboard/shell";
import { HeaderPlay } from "../../_components/header-play";
import { CheckerForm } from "./checker-form";
import { Suspense } from "react";

export default async function CheckerPlay() {
  return (
    <Shell className="flex flex-col gap-8">
      <HeaderPlay
        title="Global Speed Checker"
        description={
          <>
            Is your{" "}
            <span className="text-foreground">endpoint globally fast</span>?
            Test your website and API performance across all continents.
          </>
        }
      />
      <div className="mx-auto grid w-full max-w-xl gap-6">
        <Suspense fallback={null}>
          <CheckerForm />
        </Suspense>
      </div>
    </Shell>
  );
}
