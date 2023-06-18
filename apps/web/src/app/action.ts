"use server";

export async function waitlist(data: FormData) {
  const email = data.get("email");
  if (email) {
    await wait(3000);
    // TODO: save email to Highstorm
  }
  return;
}

const wait = (ms: number): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
};
