import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return <SignUp redirectUrl={"/app"} afterSignUpUrl={"/app"} />;
}
