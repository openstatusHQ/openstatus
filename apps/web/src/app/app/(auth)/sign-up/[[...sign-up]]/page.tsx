import { redirect } from "next/navigation";
import { auth, SignUp } from "@clerk/nextjs";

export default function Page() {
  const { userId } = auth();

  // TODO: we can improve the UX here. If user is logged in, (s)he will see the screen for a quick moment
  if (userId) {
    redirect("/app");
  }

  return <SignUp redirectUrl={"/app"} afterSignUpUrl={"/app"} />;
}
