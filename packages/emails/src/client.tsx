/** @jsxImportSource react */

import { render } from "@react-email/render";
import { Resend } from "resend";
import { FollowUpEmail } from "../emails/followup";

export class EmailClient {
  public readonly client: Resend;

  constructor(opts: { apiKey: string }) {
    this.client = new Resend(opts.apiKey);
  }

  public async sendFollowUp(req: { to: string }) {
    if (process.env.NODE_ENV === "development") return;

    const html = await render(<FollowUpEmail />);
    try {
      const result = await this.client.emails.send({
        from: "Thibault Le Ouay Ducasse <thibault@openstatus.dev>",
        subject: "How's it going with OpenStatus?",
        to: req.to,
        html,
      });

      if (!result.error) {
        console.log(`Sent follow up email to ${req.to}`);
        return;
      }

      throw result.error;
    } catch (err) {
      console.error(`Error sending follow up email to ${req.to}: ${err}`);
    }
  }
}
