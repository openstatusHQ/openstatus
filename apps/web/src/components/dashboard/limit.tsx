import Link from "next/link";

export function Limit() {
  return (
    <div className="col-span-full text-center">
      <p className="text-muted-foreground text-sm">
        You have reached the account limits. Please{" "}
        <Link
          href={"./settings/billing"}
          className="text-foreground underline underline-offset-4 hover:no-underline"
        >
          upgrade
        </Link>{" "}
        your account.
      </p>
    </div>
  );
}
