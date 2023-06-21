import * as React from "react";

interface EmailTemplateProps {
  firstName: string;
}

// TODO: rename and content
export const EmailTemplate = ({ firstName }: EmailTemplateProps) => (
  <div>
    <h1>Welcome, {firstName}!</h1>
  </div>
);
