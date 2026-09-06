import { OpenStatusLoadingIcon } from "@openstatus/icons/brand";

export default function RootLoading() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center">
      <OpenStatusLoadingIcon className="text-foreground size-12" />
      <span className="sr-only">Loading</span>
    </div>
  );
}
