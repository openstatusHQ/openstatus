import { SignIn } from "@clerk/nextjs";

import { SignInButton } from "../../sign-in-button";

export default function Page() {
  // return <SignIn redirectUrl={"/app"} afterSignInUrl={"/app"} />;
  return <SignInButton />;
}
