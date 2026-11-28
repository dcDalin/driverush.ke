/**
 * Shown on the school pages and the console to someone not signed in (or
 * signed in as someone with no place there).
 */
import { Button } from "~/components/ui/button";
import { useSignInSheet } from "~/lib/auth/sign-in-sheet-store";

export function NeedsSignIn({ title, body }: { title: string; body: string }) {
  const show = useSignInSheet((s) => s.show);
  return (
    <section className="mx-auto flex max-w-md flex-col items-start gap-4 py-16">
      <h1 className="font-display text-[28px] font-bold tracking-tight">
        {title}
      </h1>
      <p className="text-ink-2">{body}</p>
      <Button type="button" variant="rush" onClick={() => show("account")}>
        Sign in
      </Button>
    </section>
  );
}

export function NothingHere({ title, body }: { title: string; body: string }) {
  return (
    <section className="mx-auto flex max-w-md flex-col items-start gap-3 py-16">
      <h1 className="font-display text-[28px] font-bold tracking-tight">
        {title}
      </h1>
      <p className="text-ink-2">{body}</p>
    </section>
  );
}
