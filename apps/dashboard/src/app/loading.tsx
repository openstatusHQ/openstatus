import { OpenStatusIcon } from "@openstatus/icons/brand";

export default function RootLoading() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center">
      <OpenStatusIcon className="animate-spin-half text-foreground size-12" />
      <span className="sr-only">Loading</span>
    </div>
  );
}
