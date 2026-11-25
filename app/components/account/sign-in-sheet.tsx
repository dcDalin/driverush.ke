/**
 * The one sign-in sheet, mounted once in the app shell and opened through
 * `useSignInSheet().show()`. Three ways in:
 *
 *   1. Email code (the main way, and how a new account is made): type an
 *      email, get a 6-digit code, type it here.
 *   2. Google, when this build turns it on (`VITE_AUTH_GOOGLE=on`).
 *   3. Email and password, for people who have set one (school and
 *      DriveRush staff need it for their consoles).
 *
 * A school that added the learner's email links them the moment the code is
 * confirmed; that happens in the database, not here.
 */
import * as React from "react";
import { toast } from "sonner";
import { useLocation } from "react-router";

import { Icon } from "~/components/brand/icon";
import { ArrowLeftIcon, LockIcon, MailIcon } from "~/components/brand/icons";
import { TrafficLoader } from "~/components/brand/traffic-loader";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import {
  CODE_LENGTH,
  cleanCode,
  googleEnabled,
  normalizeEmail,
  sendEmailCode,
  signInErrorMessage,
  signInWithGoogle,
  signInWithPassword,
  verifyEmailCode,
} from "~/lib/auth/sign-in";
import { useSignInSheet } from "~/lib/auth/sign-in-sheet-store";

type Step = "email" | "code" | "password";

const TITLES = {
  account: "Sign in",
  "save-progress": "Save your progress",
} as const;

export default function SignInSheet() {
  const open = useSignInSheet((s) => s.open);
  const reason = useSignInSheet((s) => s.reason);
  const setOpen = useSignInSheet((s) => s.setOpen);
  const { pathname } = useLocation();

  const [step, setStep] = React.useState<Step>("email");
  const [email, setEmail] = React.useState("");
  const [code, setCode] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Start fresh each time the sheet opens.
  React.useEffect(() => {
    if (open) {
      setStep("email");
      setCode("");
      setPassword("");
      setError(null);
      setBusy(false);
    }
  }, [open]);

  const done = () => {
    setOpen(false);
    toast.success("You are signed in.");
  };

  async function onSendCode(event?: { preventDefault(): void }) {
    event?.preventDefault();
    const clean = normalizeEmail(email);
    if (!clean) {
      setError("Type a full email address, like name@gmail.com.");
      return;
    }
    setBusy(true);
    setError(null);
    const failure = await sendEmailCode(clean);
    setBusy(false);
    if (failure) {
      setError(signInErrorMessage(failure));
      return;
    }
    setEmail(clean);
    setCode("");
    setStep("code");
  }

  async function onVerify(event: React.FormEvent) {
    event.preventDefault();
    if (code.length !== CODE_LENGTH) {
      setError(`The code has ${CODE_LENGTH} digits.`);
      return;
    }
    setBusy(true);
    setError(null);
    const failure = await verifyEmailCode(email, code);
    setBusy(false);
    if (failure) {
      setError(signInErrorMessage(failure));
      return;
    }
    done();
  }

  async function onPassword(event: React.FormEvent) {
    event.preventDefault();
    const clean = normalizeEmail(email);
    if (!clean || !password) {
      setError("Type your email and password.");
      return;
    }
    setBusy(true);
    setError(null);
    const failure = await signInWithPassword(clean, password);
    setBusy(false);
    if (failure) {
      setError(signInErrorMessage(failure));
      return;
    }
    done();
  }

  async function onGoogle() {
    setBusy(true);
    setError(null);
    const failure = await signInWithGoogle(pathname);
    // On success the browser is already leaving for Google.
    if (failure) {
      setBusy(false);
      setError(signInErrorMessage(failure));
    }
  }

  const description =
    step === "code"
      ? `We sent a ${CODE_LENGTH}-digit code to ${email}. It can take a minute; check spam too.`
      : step === "password"
        ? "For accounts that have a password."
        : reason === "save-progress"
          ? "Sign in with your email and your progress stays with you on any phone. No password needed."
          : "We email you a code. No password needed.";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="w-full max-w-md p-0">
        <SheetHeader>
          <SheetTitle>{TITLES[reason]}</SheetTitle>
        </SheetHeader>
        <SheetBody className="flex flex-col gap-5">
          <SheetDescription className="text-[14px] text-ink-2">
            {description}
          </SheetDescription>
          {step === "email" && (
            <>
              <form
                onSubmit={onSendCode}
                className="flex flex-col gap-3"
                noValidate
              >
                <Label htmlFor="sign-in-email">Email</Label>
                <Input
                  id="sign-in-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="name@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={error ? true : undefined}
                  disabled={busy}
                  autoFocus
                />
                <Button type="submit" variant="rush" disabled={busy}>
                  {busy ? (
                    <TrafficLoader size="sm" aria-label="Sending" />
                  ) : (
                    <Icon icon={MailIcon} size={16} />
                  )}
                  Email me a code
                </Button>
              </form>
              {googleEnabled() && (
                <Button
                  type="button"
                  variant="paper"
                  onClick={onGoogle}
                  disabled={busy}
                >
                  Continue with Google
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="self-start"
                onClick={() => {
                  setError(null);
                  setStep("password");
                }}
              >
                <Icon icon={LockIcon} size={14} />
                Sign in with a password
              </Button>
            </>
          )}

          {step === "code" && (
            <form
              onSubmit={onVerify}
              className="flex flex-col gap-3"
              noValidate
            >
              <Label htmlFor="sign-in-code">Code</Label>
              <Input
                id="sign-in-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(cleanCode(e.target.value))}
                aria-invalid={error ? true : undefined}
                className="font-mono text-[20px] tracking-[0.3em]"
                disabled={busy}
                autoFocus
              />
              <Button type="submit" variant="rush" disabled={busy}>
                {busy && <TrafficLoader size="sm" aria-label="Checking" />}
                Sign in
              </Button>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setError(null);
                    setStep("email");
                  }}
                >
                  <Icon icon={ArrowLeftIcon} size={14} />
                  Use a different email
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onSendCode}
                  disabled={busy}
                >
                  Send a new code
                </Button>
              </div>
            </form>
          )}

          {step === "password" && (
            <form
              onSubmit={onPassword}
              className="flex flex-col gap-3"
              noValidate
            >
              <Label htmlFor="sign-in-password-email">Email</Label>
              <Input
                id="sign-in-password-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy}
                autoFocus
              />
              <Label htmlFor="sign-in-password">Password</Label>
              <Input
                id="sign-in-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={error ? true : undefined}
                disabled={busy}
              />
              <Button type="submit" variant="rush" disabled={busy}>
                {busy && <TrafficLoader size="sm" aria-label="Signing in" />}
                Sign in
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="self-start"
                onClick={() => {
                  setError(null);
                  setStep("email");
                }}
              >
                <Icon icon={ArrowLeftIcon} size={14} />
                Use an email code instead
              </Button>
            </form>
          )}

          {error && (
            <p role="alert" className="text-[14px] font-medium text-rush">
              {error}
            </p>
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
