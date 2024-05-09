"use server";

import { signIn } from "@/lib/auth";

export async function signInWithResendAction(formData: FormData) {
  try {
    await signIn("resend", formData);
  } catch (e) {
    // console.error(e);
  }
}
