import { Suspense } from "react";
import { CheckerForm } from "./checker-form";
import {
  CardContainer,
  CardDescription,
  CardHeader,
  CardIcon,
  CardTitle,
} from "@/components/marketing/card";

export default async function CheckerPlay() {
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
          <CheckerForm />
        </Suspense>
      </div>
    </CardContainer>
  );
}
