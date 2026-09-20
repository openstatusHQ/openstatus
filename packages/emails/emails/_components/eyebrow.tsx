/** @jsxRuntime automatic @jsxImportSource react */

import { Text } from "react-email";

import { styles } from "./styles";

export function Eyebrow({ items }: { items: Array<string | undefined> }) {
  return (
    <Text style={{ ...styles.label, margin: "0 0 10px" }}>
      {items.filter(Boolean).join(" · ")}
    </Text>
  );
}
