/**
 * Mailpit helper for Playwright / local dev.
 * Fetches the latest OTP email for a given address.
 *
 * Usage in a Playwright test:
 *   const otp = await getLatestOtp(page, 'admin@storia.app');
 */

const MAILPIT_API = process.env.MAILPIT_URL || "http://localhost:8025/api/v1";

export async function getLatestOtp(
  email: string,
  opts?: { retries?: number; delayMs?: number }
): Promise<string | null> {
  const { retries = 10, delayMs = 500 } = opts ?? {};

  for (let i = 0; i < retries; i++) {
    const res = await fetch(
      `${MAILPIT_API}/search?kind=to&query=${encodeURIComponent(email)}`
    );
    if (!res.ok) {
      await sleep(delayMs);
      continue;
    }

    const data = await res.json();
    const messages = data.messages as Array<{
      ID: string;
      Subject: string;
      Created: string;
    }>;

    if (!messages || messages.length === 0) {
      await sleep(delayMs);
      continue;
    }

    // Sort by newest first
    messages.sort(
      (a, b) => new Date(b.Created).getTime() - new Date(a.Created).getTime()
    );

    const latest = messages[0];

    // Fetch full message body
    const msgRes = await fetch(`${MAILPIT_API}/message/${latest.ID}`);
    if (!msgRes.ok) {
      await sleep(delayMs);
      continue;
    }
    const msg = await msgRes.json();

    // Extract OTP from plain-text body
    const textBody: string = msg.Text || "";
    const match = textBody.match(/\b\d{6}\b/);
    if (match) return match[0];

    await sleep(delayMs);
  }

  return null;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function deleteAllMessages(): Promise<void> {
  await fetch(`${MAILPIT_API}/messages`, { method: "DELETE" });
}
