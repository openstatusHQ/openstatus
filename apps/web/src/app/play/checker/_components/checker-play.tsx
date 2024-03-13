import { Shell } from "@/components/dashboard/shell";
import { HeaderPlay } from "../../_components/header-play";
import { CheckerForm } from "./checker-form";

export default async function CheckerPlay() {
  return (
    <Shell className="flex flex-col gap-8">
      <HeaderPlay
        title="Is your endpoint fast?"
        description="Check the performance of your website, API from the different continents."
      />
      <div className="mx-auto grid w-full max-w-xl gap-6">
        <CheckerForm />
      </div>
    </Shell>
  );
}
