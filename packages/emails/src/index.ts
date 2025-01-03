import { Alert } from "../emails/alert";
import { FollowUpEmail } from "../emails/followup";
import { SubscribeEmail } from "../emails/subscribe";
import { WelcomeEmail } from "../emails/welcome";
import { validateEmailNotDisposable } from "./utils";

export {
  WelcomeEmail,
  validateEmailNotDisposable,
  Alert,
  SubscribeEmail,
  FollowUpEmail,
};

export { sendEmail, sendEmailHtml } from "./send";

export { EmailClient } from "./client";
