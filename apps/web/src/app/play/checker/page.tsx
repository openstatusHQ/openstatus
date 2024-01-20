import type { Metadata } from "next";

import { Shell } from "@/components/dashboard/shell";
import { BackButton } from "@/components/layout/back-button";
import { CheckerForm } from "./_components/checker-form";

export const metadata: Metadata = {
  title: "Speed Checker - OpenStatus",
  description:
    "Get speed insights for your api, website from multiple regions.",
};

export default async function PlayPage() {
  return (
    <>
      <BackButton href="/" />
      <Shell className="grid gap-8">
        <div className="mx-auto grid gap-4 text-center">
          <p className="font-cal mb-1 text-3xl">
            How fast is my Website? API Endpoint?
          </p>
          <p className="text-muted-foreground text-lg">
            Get speed insights for your api, website from multiple regions.
          </p>
        </div>
        <div className="mx-auto grid w-full max-w-xl gap-6">
          <CheckerForm />
          <p className="text-center text-sm">
            This free speed checker lets you analyze the load speed of your
            site. You can enter the URL of any website, or any API endpoint and
            get a detailed report of the load speed of the website.
          </p>
        </div>
      </Shell>
    </>
  );
}
