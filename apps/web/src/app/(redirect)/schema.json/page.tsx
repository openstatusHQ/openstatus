import { redirect } from "next/navigation";

export default function SchemaJsonRedirect() {
  return redirect("https://github.com/openstatusHQ/json-schema/releases/latest/download/schema.json");
}
