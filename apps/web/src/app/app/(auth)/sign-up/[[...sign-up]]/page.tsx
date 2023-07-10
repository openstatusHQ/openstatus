import { SignUp, useSignUp } from "@clerk/nextjs";

export default function Page() {
  const { signUp } = useSignUp();

  console.log("signUp", signUp);
  return <SignUp redirectUrl={"/app"} />;
}
