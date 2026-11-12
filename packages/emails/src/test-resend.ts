import { vi } from "vitest";

import { resend } from "./send";

// safe because the senders read only `data` and `error` of the response
export function stubResendSend() {
  return vi
    .spyOn(resend.emails, "send")
    .mockImplementation(() =>
      Promise.resolve({ data: { id: "email_1" }, error: null } as never),
    );
}
