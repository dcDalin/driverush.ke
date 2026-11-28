/**
 * The local stack's mail catcher (Mailpit, port 54724): the newest
 * 6-digit code sent to an address. Polls, since the email lands a moment later.
 */
const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54724";

type Summary = { ID: string; Created: string };

export async function latestCode(
  email: string,
  sentAfter: number,
): Promise<string> {
  for (let attempt = 0; attempt < 40; attempt++) {
    const search = await fetch(
      `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}&limit=5`,
    );
    const { messages = [] } = (await search.json()) as { messages?: Summary[] };
    const fresh = messages.find(
      (m) => Date.parse(m.Created) >= sentAfter - 2000,
    );
    if (fresh) {
      const message = (await (
        await fetch(`${MAILPIT}/api/v1/message/${fresh.ID}`)
      ).json()) as { Text: string };
      const code = message.Text.match(/\b\d{6}\b/)?.[0];
      if (code) return code;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`No code reached ${email}`);
}
