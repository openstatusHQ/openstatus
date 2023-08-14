import { redirect } from "next/navigation";
import { auth, SignIn } from "@clerk/nextjs";

export default function Page() {
  const { userId } = auth();

  if (userId) {
    redirect("/app");
  }

  return <SignIn redirectUrl={"/app"} afterSignInUrl={"/app"} />;
}
