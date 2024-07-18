import Link from "next/link";

export function Limit() {
  return (
    <div className="col-span-full text-center">
      <p className="text-foreground text-sm">
        You have reached the account limits. Please{" "}
        <Link href={"./settings/billing"} className="underline">
          upgrade
        </Link>{" "}
        your account.
      </p>
    </div>
  );
}
