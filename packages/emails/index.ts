import { Alert, EmailDataSchema } from "./emails/alert";
import SubscribeEmail from "./emails/subscribe";
import { validateEmailNotDisposable } from "./emails/utils/utils";
import WaitingList from "./emails/waiting-list";
import WelcomeEmail from "./emails/welcome";

export {
  WelcomeEmail,
  WaitingList,
  validateEmailNotDisposable,
  Alert,
  EmailDataSchema,
  SubscribeEmail,
};

export { sendEmail, sendEmailHtml } from "./emails/send";
