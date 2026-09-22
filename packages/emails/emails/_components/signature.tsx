/** @jsxRuntime automatic @jsxImportSource react */

import { Hr, Text } from "react-email";

import { colors } from "./styles";

export function Signature({
  name = "Thibault",
  role = "Co-founder, openstatus",
}: {
  name?: string;
  role?: string;
}) {
  return (
    <>
      <Hr style={{ margin: "28px 0 20px", borderColor: colors.border }} />
      <Text
        style={{
          margin: 0,
          fontSize: "15px",
          lineHeight: "22px",
          color: colors.body,
        }}
      >
        {name}
      </Text>
      <Text
        style={{
          margin: 0,
          fontSize: "13px",
          lineHeight: "20px",
          color: colors.faint,
        }}
      >
        {role}
      </Text>
    </>
  );
}
