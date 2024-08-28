import {
  CardContainer,
  CardDescription,
  CardHeader,
  CardIcon,
  CardTitle,
} from "@/components/marketing/card";
import type { CachedRegionChecker } from "@/components/ping-response-analysis/utils";
import { Suspense } from "react";
import { CheckerForm } from "./checker-form";

export default async function CheckerPlay({
  data,
}: {
  data: CachedRegionChecker | null;
}) {
  return (
    <CardContainer>
      <CardHeader>
        <CardIcon icon="gauge" />
        <CardTitle>Global Speed Checker</CardTitle>
        <CardDescription className="max-w-md">
          Is your{" "}
          <span className="text-foreground">endpoint globally fast</span>? Test
          your website and API performance across all continents.
        </CardDescription>
      </CardHeader>

      <div className="mx-auto grid w-full max-w-xl gap-6">
        <Suspense fallback={null}>
          <CheckerForm
            defaultValues={
              data
                ? { redirect: false, ...data }
                : { redirect: false, url: "", method: "GET" }
            }
            defaultData={data?.checks.sort((a, b) => a.latency - b.latency)}
          />
        </Suspense>
      </div>
    </CardContainer>
  );
}
