import { Alert, EmailDataSchema } from "../emails/alert";
import { FollowUpEmail } from "../emails/followup";
import { SubscribeEmail } from "../emails/subscribe";
import { WaitingList } from "../emails/waiting-list";
import { WelcomeEmail } from "../emails/welcome";
import { validateEmailNotDisposable } from "./utils";

export {
  WelcomeEmail,
  WaitingList,
  validateEmailNotDisposable,
  Alert,
  EmailDataSchema,
  SubscribeEmail,
  FollowUpEmail,
};

export { sendEmail, sendEmailHtml } from "./send";

export { EmailClient } from "./client";
