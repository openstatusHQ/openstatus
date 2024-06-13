import { Alert, EmailDataSchema } from "./emails/alert";
import { FollowUpEmail } from "./emails/followup";
import SubscribeEmail from "./emails/subscribe";
import { validateEmailNotDisposable } from "./emails/utils/utils";
import WaitingList from "./emails/waiting-list";
import { WelcomeEmail } from "./emails/welcome";

export {
  WelcomeEmail,
  WaitingList,
  validateEmailNotDisposable,
  Alert,
  EmailDataSchema,
  SubscribeEmail,
  FollowUpEmail,
};

export { sendEmail, sendEmailHtml } from "./emails/send";
