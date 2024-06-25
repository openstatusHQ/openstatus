import { Shell } from "@/components/dashboard/shell";
import { HeaderPlay } from "../../_components/header-play";
import { CheckerForm } from "./checker-form";

export default async function CheckerPlay() {
  return (
    <Shell className="flex flex-col gap-8">
      <HeaderPlay
        title="Is your endpoint globally fast?"
        description="Test your website and API performance across all continents. "
      />
      <div className="mx-auto grid w-full max-w-xl gap-6">
        <CheckerForm />
      </div>
    </Shell>
  );
}
