import * as React from "react";
import { Button, Html } from "@react-email/components";

const WelcomeEmail = () => {
  return (
    <Html>
      <Button
        pX={20}
        pY={12}
        href="https://example.com"
        style={{ background: "#000", color: "#fff" }}
      >
        Click me
      </Button>
    </Html>
  );
};

export default WelcomeEmail;
