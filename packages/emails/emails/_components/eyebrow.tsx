/** @jsxRuntime automatic @jsxImportSource react */

import { Text } from "react-email";

import { styles } from "./styles";

export function Eyebrow({ items }: { items: Array<string | undefined> }) {
  const shown = items.filter(Boolean);
  if (shown.length === 0) return null;
  return (
    <Text style={{ ...styles.label, margin: "0 0 10px" }}>
      {shown.join(" · ")}
    </Text>
  );
}
