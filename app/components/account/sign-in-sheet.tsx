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
 * Browser-side forms (the session lives in the browser's client), so plain
 * react-hook-form with the shared zod schemas and the client field kit. A
 * school that added the learner's email links them the moment the code is
 * confirmed; that happens in the database, not here.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import * as React from "react";
import { FormProvider, useForm } from "react-hook-form";
import { useLocation } from "react-router";
import { toast } from "sonner";

import { Icon } from "~/components/brand/icon";
import { ArrowLeftIcon, LockIcon, MailIcon } from "~/components/brand/icons";
import { Button } from "~/components/ui/button";
import { InputField, OtpField } from "~/components/ui/forms/client";
import { FieldError } from "~/components/ui/forms/common";
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
  googleEnabled,
  sendEmailCode,
  signInWithGoogle,
  signInWithPassword,
  verifyEmailCode,
} from "~/lib/auth/sign-in";
import { useSignInSheet } from "~/lib/auth/sign-in-sheet-store";
import {
  EmailCodeRequestSchema,
  type EmailCodeRequestSchemaTypes,
  PasswordSignInSchema,
  type PasswordSignInSchemaTypes,
  VerifyEmailCodeSchema,
  type VerifyEmailCodeSchemaTypes,
} from "~/schemas/auth";

type Step = "email" | "code" | "password";

const TITLES = {
  account: "Sign in",
  "save-progress": "Save your progress",
} as const;

export default function SignInSheet() {
  const open = useSignInSheet((s) => s.open);
  const reason = useSignInSheet((s) => s.reason);
  const setOpen = useSignInSheet((s) => s.setOpen);

  const [step, setStep] = React.useState<Step>("email");
  const [email, setEmail] = React.useState("");

  // Start fresh each time the sheet opens.
  React.useEffect(() => {
    if (open) setStep("email");
  }, [open]);

  const done = () => {
    setOpen(false);
    toast.success("You are signed in.");
  };

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
            <EmailStep
              defaultEmail={email}
              onSent={(sentTo) => {
                setEmail(sentTo);
                setStep("code");
              }}
              onPassword={() => setStep("password")}
            />
          )}
          {step === "code" && (
            <CodeStep
              email={email}
              onDone={done}
              onBack={() => setStep("email")}
            />
          )}
          {step === "password" && (
            <PasswordStep
              defaultEmail={email}
              onDone={done}
              onBack={() => setStep("email")}
            />
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

function EmailStep({
  defaultEmail,
  onSent,
  onPassword,
}: {
  defaultEmail: string;
  onSent: (email: string) => void;
  onPassword: () => void;
}) {
  const { pathname } = useLocation();
  const [failure, setFailure] = React.useState<string | null>(null);
  const [googleBusy, setGoogleBusy] = React.useState(false);
  const methods = useForm<EmailCodeRequestSchemaTypes>({
    resolver: zodResolver(EmailCodeRequestSchema),
    defaultValues: { email: defaultEmail },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });
  const busy = methods.formState.isSubmitting;

  const onSubmit = methods.handleSubmit(async ({ email }) => {
    setFailure(null);
    const { error } = await sendEmailCode(email);
    if (error) setFailure(error);
    else onSent(email);
  });

  return (
    <>
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
            {!busy && <Icon icon={MailIcon} size={16} />}
            Email me a code
          </Button>
        </form>
      </FormProvider>
      {googleEnabled() && (
        <Button
          type="button"
          variant="paper"
          isLoading={googleBusy}
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
          Continue with Google
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="self-start"
        onClick={onPassword}
      >
        <Icon icon={LockIcon} size={14} />
        Sign in with a password
      </Button>
      {failure && <FieldError>{failure}</FieldError>}
    </>
  );
}

function CodeStep({
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
          Sign in
        </Button>
        {failure && <FieldError>{failure}</FieldError>}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onBack}>
            <Icon icon={ArrowLeftIcon} size={14} />
            Use a different email
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            isLoading={resending}
            disabled={busy}
            onClick={async () => {
              setResending(true);
              const { error } = await sendEmailCode(email);
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

function PasswordStep({
  defaultEmail,
  onDone,
  onBack,
}: {
  defaultEmail: string;
  onDone: () => void;
  onBack: () => void;
}) {
  const [failure, setFailure] = React.useState<string | null>(null);
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
    if (error) setFailure(error);
    else onDone();
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
            autoFocus: true,
          }}
        />
        <InputField
          name="password"
          label="Password"
          disabled={busy}
          inputProps={{ type: "password", autoComplete: "current-password" }}
        />
        <Button type="submit" variant="rush" isLoading={busy}>
          Sign in
        </Button>
        {failure && <FieldError>{failure}</FieldError>}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={onBack}
        >
          <Icon icon={ArrowLeftIcon} size={14} />
          Use an email code instead
        </Button>
      </form>
    </FormProvider>
  );
}
