import Link from "next/link";

export function TermsAndConditions() {
  return (
    <p className="text-muted-foreground px-8 text-center text-sm">
      By clicking continue, you agree to our{" "}
      <Link
        href="/legal/terms"
        className="hover:text-primary underline underline-offset-4 hover:no-underline"
      >
        Terms of Service
      </Link>{" "}
      and{" "}
      <Link
        href="/legal/privacy"
        className="hover:text-primary underline underline-offset-4 hover:no-underline"
      >
        Privacy Policy
      </Link>
      .
    </p>
  );
}
