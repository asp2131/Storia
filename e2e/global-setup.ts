/**
 * Playwright global setup — clears Mailpit inbox before the test run.
 */
import { deleteAllMessages } from "./helpers/mailpit";

export default async function globalSetup() {
  await deleteAllMessages();
  console.log("[e2e setup] Mailpit inbox cleared");
}
