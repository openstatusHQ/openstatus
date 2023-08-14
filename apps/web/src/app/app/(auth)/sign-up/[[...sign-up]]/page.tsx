import { redirect } from "next/navigation";
import { auth, SignUp } from "@clerk/nextjs";

export default function Page() {
  const { userId } = auth();

  if (userId) {
    redirect("/app");
  }

  return <SignUp redirectUrl={"/app"} afterSignUpUrl={"/app"} />;
}
