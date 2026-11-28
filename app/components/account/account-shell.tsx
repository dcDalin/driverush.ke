/**
 * Mounts the sign-in sheet once for the whole app. The sheet (and the
 * Supabase client it pulls in) loads only the first time someone opens it.
 */
import * as React from "react";

import { useSignInSheet } from "~/lib/auth/sign-in-sheet-store";

const SignInSheet = React.lazy(() => import("./sign-in-sheet"));

export function AccountShell() {
  const open = useSignInSheet((s) => s.open);
  const [wanted, setWanted] = React.useState(false);
  React.useEffect(() => {
    if (open) setWanted(true);
  }, [open]);
  if (!wanted) return null;
  return (
    <React.Suspense fallback={null}>
      <SignInSheet />
    </React.Suspense>
  );
}
