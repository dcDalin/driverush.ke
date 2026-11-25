/**
 * shadcn's input-otp, in the house look: one box per digit, the code typed or
 * pasted in one go, and the phone's "from Messages" suggestion kept
 * (`autoComplete="one-time-code"`).
 */
import { OTPInput, OTPInputContext } from "input-otp";
import * as React from "react";

import { cn } from "~/lib/utils";

function InputOTP({
  className,
  containerClassName,
  ...props
}: React.ComponentProps<typeof OTPInput> & { containerClassName?: string }) {
  return (
    <OTPInput
      data-slot="input-otp"
      containerClassName={cn(
        "flex items-center gap-2 has-disabled:opacity-50",
        containerClassName,
      )}
      className={cn("disabled:cursor-not-allowed", className)}
      {...props}
    />
  );
}

function InputOTPGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-otp-group"
      className={cn("flex items-center gap-1.5", className)}
      {...props}
    />
  );
}

function InputOTPSlot({
  index,
  className,
  ...props
}: React.ComponentProps<"div"> & { index: number }) {
  const context = React.useContext(OTPInputContext);
  const slot = context?.slots[index];
  return (
    <div
      data-slot="input-otp-slot"
      data-active={slot?.isActive}
      className={cn(
        "relative flex h-12 w-10 items-center justify-center rounded-lg border border-input bg-surface font-mono text-[20px] font-semibold text-ink shadow-xs transition-[border-color,box-shadow] duration-150",
        "data-[active=true]:z-10 data-[active=true]:border-rush data-[active=true]:ring-4 data-[active=true]:ring-rush/15",
        "aria-invalid:border-rush",
        className,
      )}
      {...props}
    >
      {slot?.char}
      {slot?.hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-5 w-px animate-caret-blink bg-ink" />
        </div>
      )}
    </div>
  );
}

export { InputOTP, InputOTPGroup, InputOTPSlot };
