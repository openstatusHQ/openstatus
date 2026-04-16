import { ShieldAlert } from "lucide-react";

export default function RestrictedPage() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <ShieldAlert className="h-12 w-12 text-muted-foreground" />
      <h1 className="font-semibold text-2xl">Access Restricted</h1>
      <p className="text-muted-foreground">
        This status page is restricted and cannot be accessed from your network.
      </p>
    </div>
  );
}
