/**
 * The one sign-in sheet, mounted once in the app shell and opened through
 * `useSignInSheet().show()`. Two ways in:
 *
 *   1. Google, the first choice, when this build turns it on
 *      (`VITE_AUTH_GOOGLE=on`).
 *   2. Email and password. A new account confirms its email with a 6-digit
 *      code; a forgotten password is replaced with one.
 *
 * DriveRush staff roles count on either (owner, 2026-11-28), never on the
 * code session a password reset signs in with.
 *
 * Browser-side forms (the session lives in the browser's client), so plain
 * react-hook-form with the shared zod schemas and the client field kit. A
 * school that added the learner's email links them the moment the address is
 * confirmed; that happens in the database, not here.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import * as React from "react";
import { FormProvider, useForm } from "react-hook-form";
import { useLocation } from "react-router";
import { toast } from "sonner";

import { Icon } from "~/components/brand/icon";
import { ArrowLeftIcon, GoogleIcon } from "~/components/brand/icons";
import { Button } from "~/components/ui/button";
import { InputField, OtpField } from "~/components/ui/forms/client";
import { FieldError } from "~/components/ui/forms/common";
import { Separator } from "~/components/ui/separator";
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
  EMAIL_NOT_CONFIRMED,
  googleEnabled,
  resendSignUpCode,
  sendPasswordReset,
  setPassword,
  signInWithGoogle,
  signInWithPassword,
  signUpWithPassword,
  verifyEmailCode,
  verifyResetCode,
} from "~/lib/auth/sign-in";
import { useSignInSheet } from "~/lib/auth/sign-in-sheet-store";
import {
  PasswordResetRequestSchema,
  type PasswordResetRequestSchemaTypes,
  PasswordResetSchema,
  type PasswordResetSchemaTypes,
  PasswordSignInSchema,
  type PasswordSignInSchemaTypes,
  SignUpSchema,
  type SignUpSchemaTypes,
  VerifyEmailCodeSchema,
  type VerifyEmailCodeSchemaTypes,
} from "~/schemas/auth";

type Step = "sign-in" | "sign-up" | "confirm" | "forgot" | "reset";

const TITLES = {
  account: "Sign in",
  "save-progress": "Save your progress",
} as const;

const STEP_TITLES: Partial<Record<Step, string>> = {
  "sign-up": "Create your account",
  confirm: "Confirm your email",
  forgot: "Set a new password",
  reset: "Set a new password",
};

const PASSWORD_RULE = "At least 8 characters, with letters and numbers.";

export default function SignInSheet() {
  const open = useSignInSheet((s) => s.open);
  const reason = useSignInSheet((s) => s.reason);
  const setOpen = useSignInSheet((s) => s.setOpen);

  const [step, setStep] = React.useState<Step>("sign-in");
  const [email, setEmail] = React.useState("");

  // Start fresh each time the sheet opens.
  React.useEffect(() => {
    if (open) setStep("sign-in");
  }, [open]);

  const done = (message = "You are signed in.") => {
    setOpen(false);
    toast.success(message);
  };

  const sentTo = `We sent a ${CODE_LENGTH}-digit code to ${email}. It can take a minute; check spam too.`;
  const withGoogle = googleEnabled();
  const description: Record<Step, string> = {
    "sign-in":
      reason === "save-progress"
        ? "Sign in and your progress stays with you on any phone."
        : withGoogle
          ? "Use your Google account, or your email and password."
          : "Use your email and password.",
    "sign-up": "Your progress stays with you on any phone.",
    confirm: sentTo,
    forgot: "Type your email and we send you a code to set a new password.",
    reset: `${sentTo} If none comes, that email has no account yet.`,
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="w-full max-w-md p-0">
        <SheetHeader>
          <SheetTitle>{STEP_TITLES[step] ?? TITLES[reason]}</SheetTitle>
        </SheetHeader>
        <SheetBody className="flex flex-col gap-5">
          <SheetDescription className="text-[14px] text-ink-2">
            {description[step]}
          </SheetDescription>
          {step === "sign-in" && (
            <SignInStep
              withGoogle={withGoogle}
              defaultEmail={email}
              onDone={() => done()}
              onUnconfirmed={(address) => {
                setEmail(address);
                setStep("confirm");
              }}
              onSignUp={() => setStep("sign-up")}
              onForgot={() => setStep("forgot")}
            />
          )}
          {step === "sign-up" && (
            <SignUpStep
              defaultEmail={email}
              onSent={(address) => {
                setEmail(address);
                setStep("confirm");
              }}
              onBack={() => setStep("sign-in")}
            />
          )}
          {step === "confirm" && (
            <ConfirmStep
              email={email}
              onDone={() => done()}
              onBack={() => setStep("sign-up")}
            />
          )}
          {step === "forgot" && (
            <ForgotStep
              defaultEmail={email}
              onSent={(address) => {
                setEmail(address);
                setStep("reset");
              }}
              onBack={() => setStep("sign-in")}
            />
          )}
          {step === "reset" && (
            <ResetStep
              email={email}
              onDone={() =>
                done("Your new password is set. You are signed in.")
              }
              onBack={() => setStep("forgot")}
            />
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

function BackButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="self-start"
      onClick={onClick}
    >
      <Icon icon={ArrowLeftIcon} size={14} />
      {children}
    </Button>
  );
}

function SignInStep({
  withGoogle,
  defaultEmail,
  onDone,
  onUnconfirmed,
  onSignUp,
  onForgot,
}: {
  withGoogle: boolean;
  defaultEmail: string;
  onDone: () => void;
  onUnconfirmed: (email: string) => void;
  onSignUp: () => void;
  onForgot: () => void;
}) {
  const { pathname } = useLocation();
  const [failure, setFailure] = React.useState<string | null>(null);
  const [googleBusy, setGoogleBusy] = React.useState(false);
  const methods = useForm<PasswordSignInSchemaTypes>({
    resolver: zodResolver(PasswordSignInSchema),
    defaultValues: { email: defaultEmail, password: "" },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });
  const busy = methods.formState.isSubmitting;

  const onSubmit = methods.handleSubmit(async ({ email, password }) => {
    setFailure(null);
    const { error } = await signInWithPassword(email, password);
    if (!error) return onDone();
    if (error === EMAIL_NOT_CONFIRMED) {
      // The account was made but its code never typed: send a new one.
      await resendSignUpCode(email);
      return onUnconfirmed(email);
    }
    setFailure(error);
  });

  return (
    <>
      {withGoogle && (
        <>
          <Button
            type="button"
            variant="rush"
            isLoading={googleBusy}
            disabled={busy}
            onClick={async () => {
              setGoogleBusy(true);
              setFailure(null);
              const { error } = await signInWithGoogle(pathname);
              // On success the browser is already leaving for Google.
              if (error) {
                setGoogleBusy(false);
                setFailure(error);
              }
            }}
          >
            {!googleBusy && <Icon icon={GoogleIcon} size={16} />}
            Continue with Google
          </Button>
          <div className="flex items-center gap-3 text-[12.5px] text-ink-3">
            <Separator className="flex-1" />
            or use your email
            <Separator className="flex-1" />
          </div>
        </>
      )}
      <FormProvider {...methods}>
        <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
          <InputField
            name="email"
            label="Email"
            disabled={busy}
            inputProps={{
              type: "email",
              inputMode: "email",
              autoComplete: "email",
              placeholder: "name@gmail.com",
              // With Google first, the keyboard stays down until it is asked for.
              autoFocus: !withGoogle,
            }}
          />
          <InputField
            name="password"
            label="Password"
            disabled={busy}
            inputProps={{ type: "password", autoComplete: "current-password" }}
          />
          <Button
            type="submit"
            variant={withGoogle ? "paper" : "rush"}
            isLoading={busy}
            disabled={googleBusy}
          >
            Sign in
          </Button>
        </form>
      </FormProvider>
      {failure && <FieldError>{failure}</FieldError>}
      <div className="flex flex-wrap gap-x-5 gap-y-1">
        <Button
          type="button"
          variant="quiet-rush"
          size="sm"
          className="px-0"
          onClick={onSignUp}
        >
          Create an account
        </Button>
        <Button
          type="button"
          variant="quiet"
          size="sm"
          className="px-0"
          onClick={onForgot}
        >
          Forgot your password?
        </Button>
      </div>
    </>
  );
}

function SignUpStep({
  defaultEmail,
  onSent,
  onBack,
}: {
  defaultEmail: string;
  onSent: (email: string) => void;
  onBack: () => void;
}) {
  const [failure, setFailure] = React.useState<string | null>(null);
  const methods = useForm<SignUpSchemaTypes>({
    resolver: zodResolver(SignUpSchema),
    defaultValues: { email: defaultEmail, password: "" },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });
  const busy = methods.formState.isSubmitting;

  const onSubmit = methods.handleSubmit(async ({ email, password }) => {
    setFailure(null);
    const { error } = await signUpWithPassword(email, password);
    if (error) setFailure(error);
    else onSent(email);
  });

  return (
    <FormProvider {...methods}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
        <InputField
          name="email"
          label="Email"
          disabled={busy}
          inputProps={{
            type: "email",
            inputMode: "email",
            autoComplete: "email",
            placeholder: "name@gmail.com",
            autoFocus: true,
          }}
        />
        <InputField
          name="password"
          label="Password"
          description={PASSWORD_RULE}
          disabled={busy}
          inputProps={{ type: "password", autoComplete: "new-password" }}
        />
        <Button type="submit" variant="rush" isLoading={busy}>
          Create account
        </Button>
        {failure && <FieldError>{failure}</FieldError>}
        <BackButton onClick={onBack}>Back to sign in</BackButton>
      </form>
    </FormProvider>
  );
}

function ConfirmStep({
  email,
  onDone,
  onBack,
}: {
  email: string;
  onDone: () => void;
  onBack: () => void;
}) {
  const [failure, setFailure] = React.useState<string | null>(null);
  const [resending, setResending] = React.useState(false);
  const methods = useForm<VerifyEmailCodeSchemaTypes>({
    resolver: zodResolver(VerifyEmailCodeSchema),
    defaultValues: { code: "" },
    mode: "onSubmit",
  });
  const busy = methods.formState.isSubmitting;

  const onSubmit = methods.handleSubmit(async ({ code }) => {
    setFailure(null);
    const { error } = await verifyEmailCode(email, code);
    if (error) setFailure(error);
    else onDone();
  });

  return (
    <FormProvider {...methods}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
        <OtpField
          name="code"
          label="Code"
          length={CODE_LENGTH}
          disabled={busy}
          autoFocus
        />
        <Button type="submit" variant="rush" isLoading={busy}>
          Confirm and sign in
        </Button>
        {failure && <FieldError>{failure}</FieldError>}
        <div className="flex flex-wrap gap-2">
          <BackButton onClick={onBack}>Use a different email</BackButton>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            isLoading={resending}
            disabled={busy}
            onClick={async () => {
              setResending(true);
              const { error } = await resendSignUpCode(email);
              setResending(false);
              if (error) setFailure(error);
              else toast("A new code is on its way.");
            }}
          >
            Send a new code
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}

function ForgotStep({
  defaultEmail,
  onSent,
  onBack,
}: {
  defaultEmail: string;
  onSent: (email: string) => void;
  onBack: () => void;
}) {
  const [failure, setFailure] = React.useState<string | null>(null);
  const methods = useForm<PasswordResetRequestSchemaTypes>({
    resolver: zodResolver(PasswordResetRequestSchema),
    defaultValues: { email: defaultEmail },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });
  const busy = methods.formState.isSubmitting;

  const onSubmit = methods.handleSubmit(async ({ email }) => {
    setFailure(null);
    const { error } = await sendPasswordReset(email);
    if (error) setFailure(error);
    else onSent(email);
  });

  return (
    <FormProvider {...methods}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
        <InputField
          name="email"
          label="Email"
          disabled={busy}
          inputProps={{
            type: "email",
            inputMode: "email",
            autoComplete: "email",
            placeholder: "name@gmail.com",
            autoFocus: true,
          }}
        />
        <Button type="submit" variant="rush" isLoading={busy}>
          Email me a code
        </Button>
        {failure && <FieldError>{failure}</FieldError>}
        <BackButton onClick={onBack}>Back to sign in</BackButton>
      </form>
    </FormProvider>
  );
}

function ResetStep({
  email,
  onDone,
  onBack,
}: {
  email: string;
  onDone: () => void;
  onBack: () => void;
}) {
  const [failure, setFailure] = React.useState<string | null>(null);
  // A code works once. If the password is then refused, the next try keeps
  // the session the code opened and only sets the password.
  const verified = React.useRef(false);
  const methods = useForm<PasswordResetSchemaTypes>({
    resolver: zodResolver(PasswordResetSchema),
    defaultValues: { code: "", password: "" },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });
  const busy = methods.formState.isSubmitting;

  const onSubmit = methods.handleSubmit(async ({ code, password }) => {
    setFailure(null);
    if (!verified.current) {
      const { error } = await verifyResetCode(email, code);
      if (error) return setFailure(error);
      verified.current = true;
    }
    const { error } = await setPassword(password);
    if (error) setFailure(error);
    else onDone();
  });

  return (
    <FormProvider {...methods}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
        <OtpField
          name="code"
          label="Code"
          length={CODE_LENGTH}
          disabled={busy}
          autoFocus
        />
        <InputField
          name="password"
          label="New password"
          description={PASSWORD_RULE}
          disabled={busy}
          inputProps={{ type: "password", autoComplete: "new-password" }}
        />
        <Button type="submit" variant="rush" isLoading={busy}>
          Set password and sign in
        </Button>
        {failure && <FieldError>{failure}</FieldError>}
        <BackButton onClick={onBack}>Use a different email</BackButton>
      </form>
    </FormProvider>
  );
}
