import type { GenerateText } from "@openstatus/services/incident";
import { generateText } from "ai";

import { SLACK_AGENT_MODEL } from "./model";

export const generateWithSlackModel: GenerateText = async ({
  system,
  prompt,
}) => {
  const result = await generateText({
    model: SLACK_AGENT_MODEL,
    system,
    prompt,
  });
  return result.text;
};
