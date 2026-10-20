import { after } from "next/server.js";

/**
 * Follow-ups that run after the response is sent. The mutation they follow
 * is already committed, so a failure is only logged under `label`. Outside a
 * request scope (tests, scripts) `after` throws and the task runs right away.
 */
export function createAfterResponse(label: string) {
  return (task: () => Promise<unknown>) => {
    const run = async () => {
      try {
        await task();
      } catch (err) {
        console.warn(`${label} failed`, err);
      }
    };
    try {
      after(run);
    } catch {
      void run();
    }
  };
}
