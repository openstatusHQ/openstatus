"use client";

import { SignIn, useSignIn, useSignUp } from "@clerk/nextjs";

export default function Page() {
  const { isLoaded, signIn } = useSignIn();

  return <SignIn redirectUrl={"/app"} />;
}
