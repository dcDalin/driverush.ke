/**
 * Where Google sends a learner back after they sign in (`/auth/callback`).
 * The browser's Supabase client swaps the code in the address for a session
 * while it starts; this page waits for that, then carries on to `next`.
 */
import * as React from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";

import { TrafficLoader } from "~/components/brand/traffic-loader";
import { Button } from "~/components/ui/button";
import { sessionReady } from "~/lib/auth/session";

export function meta() {
  return [
    { title: "Signing in | DriveRush" },
    { name: "robots", content: "noindex" },
  ];
}

function safeNext(raw: string | null) {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
}

export default function AuthCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const failed = params.get("error_description") ?? params.get("error");
  const next = safeNext(params.get("next"));

  React.useEffect(() => {
    if (failed) return;
    let live = true;
    void sessionReady().then((state) => {
      if (!live) return;
      if (state.status === "signed-in") toast.success("You are signed in.");
      navigate(next, { replace: true });
    });
    return () => {
      live = false;
    };
  }, [failed, navigate, next]);

  if (failed) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-5 text-center">
        <h1 className="font-display text-[22px] font-bold">
          Sign-in did not finish
        </h1>
        <p className="text-ink-2">
          Try again, or sign in with an email code instead.
        </p>
        <Button asChild variant="rush">
          <Link to={next}>Go back</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="grid min-h-[60vh] place-items-center">
      <TrafficLoader size="md" aria-label="Signing you in" />
    </main>
  );
}
