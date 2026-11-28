/**
 * Work the answer does not wait on: the emails an action sends once a change
 * is saved. On Vercel it runs after the response has gone (the platform's
 * `waitUntil` keeps the function alive until it is done), so a form answers
 * without waiting on Resend. Anywhere else (the local stack's Mailpit, the
 * route tests, Docker) there is no such context and it is awaited, so a test
 * sees the email land before the answer.
 *
 * `waitUntil` is read the way `@vercel/functions` reads it, from the request
 * context Vercel's runtime puts on `globalThis`; that package would bring
 * Vercel's CLI helpers along for these few lines.
 *
 * The task never fails the action: the change is saved, so an error is
 * logged and the toast still says it worked.
 */

type VercelContext = { waitUntil?: (promise: Promise<unknown>) => void };

const REQUEST_CONTEXT = Symbol.for("@vercel/request-context");

function platformWaitUntil() {
  const holder = (globalThis as Record<symbol, unknown>)[REQUEST_CONTEXT] as
    { get?: () => VercelContext | undefined } | undefined;
  return holder?.get?.()?.waitUntil;
}

export async function afterResponse(task: () => Promise<unknown>) {
  const run = Promise.resolve()
    .then(task)
    .catch((error: unknown) => {
      console.error("[after-response] a task failed", error);
    });
  const waitUntil = platformWaitUntil();
  if (waitUntil) {
    waitUntil(run);
    return;
  }
  await run;
}
