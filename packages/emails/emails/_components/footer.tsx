/** @jsxImportSource react */

import { Link, Section, Text } from "@react-email/components";
import { styles } from "./styles";

export function Footer() {
  return (
    <Section style={{ textAlign: "center" }}>
      <Text>
        <Link style={styles.link} href="https://openstatus.dev">
          Home Page
        </Link>{" "}
        ・{" "}
        <Link style={styles.link} href="mailto:ping@openstatus.dev">
          Contact Support
        </Link>
      </Text>

      <Text>OpenStatus ・ 122 Rue Amelot ・ 75011 Paris, France</Text>
    </Section>
  );
}
