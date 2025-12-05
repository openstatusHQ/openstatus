import { renderTemplate } from "./_components";

export function renderFollowUpEmail() {
  return renderTemplate(
    `
    <p>Hello 👋</p>
    <p>How's everything going with openstatus so far? Let me know if you run into any issues, or have any feedback, good or bad!</p>
    <p>Thank you,</p>
    <p>Thibault Le Ouay Ducasse</p>
    `,
    "How's it going with openstatus?",
  );
}
