import { Shell } from "@/components/dashboard/shell";
import { BackButton } from "@/components/layout/back-button";
import { InputForm } from "./_components/input-form";

export default async function PlayPage() {
  return (
    <>
      <BackButton href="/" />
      <Shell className="grid gap-8">
        <div className="mx-auto grid gap-4 text-center">
          <p className="font-cal mb-1 text-3xl">Monitor</p>
          <p className="text-muted-foreground text-lg font-light">
            Check your connection to the internet.
          </p>
        </div>
        <div className="mx-auto w-full max-w-xl">
          <InputForm />
        </div>
        <p className="text-muted-foreground mx-auto max-w-xl text-sm">
          Test your API or website from multiple regions around the world.
        </p>
      </Shell>
    </>
  );
}
