/**
 * Form fields built once (after thinkrush `packages/ui/.../forms/create-fields`)
 * and bound to whichever form context supplies `{ control, formState }`:
 * remix-hook-form for forms that post to a route action (`./server`), plain
 * react-hook-form for forms handled in the browser (`./client`). Each field
 * is a shadcn primitive inside a react-hook-form `Controller`, with its
 * label, error and description wired for screen readers.
 */
import type * as React from "react";
import {
  type Control,
  Controller,
  type FieldValues,
  get,
  type UseFormReturn,
} from "react-hook-form";

import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "~/components/ui/input-otp";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";

import { FieldFooter, plainText } from "./common";

type FormContextHook = () => Pick<
  UseFormReturn<FieldValues>,
  "control" | "formState"
>;

type BaseFieldProps = {
  name: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
  disabled?: boolean;
};

export type InputFieldProps = BaseFieldProps & {
  inputProps?: Omit<
    React.ComponentProps<"input">,
    "name" | "value" | "onChange" | "onBlur" | "ref"
  >;
};

export type TextareaFieldProps = BaseFieldProps & {
  textareaProps?: Omit<
    React.ComponentProps<"textarea">,
    "name" | "value" | "onChange" | "onBlur" | "ref"
  >;
};

export type SelectOption = { label: string; value: string };

export type SelectFieldProps = BaseFieldProps & {
  options: SelectOption[];
  placeholder?: string;
  triggerClassName?: string;
};

export type CheckboxGroupFieldProps = BaseFieldProps & {
  options: SelectOption[];
};

export type OtpFieldProps = BaseFieldProps & {
  length?: number;
  autoFocus?: boolean;
};

export function createFormFields(useFormCtx: FormContextHook, prefix: string) {
  function useFieldState(name: string) {
    const {
      control,
      formState: { errors },
    } = useFormCtx();
    const error = get(errors, name) as { message?: unknown } | undefined;
    return {
      control: control as Control,
      error: error?.message
        ? plainText(String(error.message))
        : error
          ? "Check this field."
          : null,
      footerId: `${name}-footer`,
    };
  }

  function described(
    error: string | null,
    description: React.ReactNode,
    footerId: string,
  ) {
    return error || description ? footerId : undefined;
  }

  function InputField({
    name,
    label,
    description,
    className,
    disabled,
    inputProps,
  }: InputFieldProps) {
    const { control, error, footerId } = useFieldState(name);
    return (
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <div className={cn("flex flex-col gap-1.5", className)}>
            <Label htmlFor={name}>{label}</Label>
            <Input
              id={name}
              aria-invalid={error ? true : undefined}
              aria-describedby={described(error, description, footerId)}
              disabled={disabled}
              {...field}
              value={field.value ?? ""}
              {...inputProps}
            />
            <FieldFooter
              error={error}
              description={description}
              id={footerId}
            />
          </div>
        )}
      />
    );
  }
  InputField.displayName = `${prefix}InputField`;

  function TextareaField({
    name,
    label,
    description,
    className,
    disabled,
    textareaProps,
  }: TextareaFieldProps) {
    const { control, error, footerId } = useFieldState(name);
    return (
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <div className={cn("flex flex-col gap-1.5", className)}>
            <Label htmlFor={name}>{label}</Label>
            <Textarea
              id={name}
              aria-invalid={error ? true : undefined}
              aria-describedby={described(error, description, footerId)}
              disabled={disabled}
              {...field}
              value={field.value ?? ""}
              {...textareaProps}
            />
            <FieldFooter
              error={error}
              description={description}
              id={footerId}
            />
          </div>
        )}
      />
    );
  }
  TextareaField.displayName = `${prefix}TextareaField`;

  function SelectField({
    name,
    label,
    description,
    className,
    disabled,
    options,
    placeholder,
    triggerClassName,
  }: SelectFieldProps) {
    const { control, error, footerId } = useFieldState(name);
    return (
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <div className={cn("flex flex-col gap-1.5", className)}>
            <Label htmlFor={name}>{label}</Label>
            <Select
              name={name}
              value={field.value ?? ""}
              onValueChange={field.onChange}
              disabled={disabled}
            >
              <SelectTrigger
                id={name}
                ref={field.ref}
                onBlur={field.onBlur}
                aria-invalid={error ? true : undefined}
                aria-describedby={described(error, description, footerId)}
                className={triggerClassName}
              >
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
              <SelectContent>
                {options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldFooter
              error={error}
              description={description}
              id={footerId}
            />
          </div>
        )}
      />
    );
  }
  SelectField.displayName = `${prefix}SelectField`;

  /** A yes/no as a checkbox, with the label beside it. */
  function CheckboxField({
    name,
    label,
    description,
    className,
    disabled,
  }: BaseFieldProps) {
    const { control, error, footerId } = useFieldState(name);
    return (
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <div className={cn("flex flex-col gap-1.5", className)}>
            <div className="flex items-center gap-2">
              <Checkbox
                id={name}
                checked={field.value === true}
                onCheckedChange={(checked) => field.onChange(checked === true)}
                onBlur={field.onBlur}
                disabled={disabled}
                aria-invalid={error ? true : undefined}
                aria-describedby={described(error, description, footerId)}
              />
              <Label
                htmlFor={name}
                className="text-[14px] font-medium tracking-normal text-ink normal-case"
              >
                {label}
              </Label>
            </div>
            <FieldFooter
              error={error}
              description={description}
              id={footerId}
            />
          </div>
        )}
      />
    );
  }
  CheckboxField.displayName = `${prefix}CheckboxField`;

  /** Several values from a list (an admin's branches), as checkboxes. */
  function CheckboxGroupField({
    name,
    label,
    description,
    className,
    disabled,
    options,
  }: CheckboxGroupFieldProps) {
    const { control, error, footerId } = useFieldState(name);
    return (
      <Controller
        name={name}
        control={control}
        render={({ field }) => {
          const values: string[] = Array.isArray(field.value)
            ? field.value
            : [];
          return (
            <fieldset
              className={cn("flex flex-col gap-2", className)}
              aria-invalid={error ? true : undefined}
              aria-describedby={described(error, description, footerId)}
            >
              <legend className="mb-1 font-display text-[11px] font-bold tracking-wider text-ink-2 uppercase">
                {label}
              </legend>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {options.map((option) => {
                  const id = `${name}-${option.value}`;
                  return (
                    <div key={option.value} className="flex items-center gap-2">
                      <Checkbox
                        id={id}
                        checked={values.includes(option.value)}
                        disabled={disabled}
                        onBlur={field.onBlur}
                        onCheckedChange={(checked) =>
                          field.onChange(
                            checked === true
                              ? [...values, option.value]
                              : values.filter(
                                  (value) => value !== option.value,
                                ),
                          )
                        }
                      />
                      <Label
                        htmlFor={id}
                        className="text-[14px] font-medium tracking-normal text-ink normal-case"
                      >
                        {option.label}
                      </Label>
                    </div>
                  );
                })}
              </div>
              <FieldFooter
                error={error}
                description={description}
                id={footerId}
              />
            </fieldset>
          );
        }}
      />
    );
  }
  CheckboxGroupField.displayName = `${prefix}CheckboxGroupField`;

  function SwitchField({
    name,
    label,
    description,
    className,
    disabled,
  }: BaseFieldProps) {
    const { control, error, footerId } = useFieldState(name);
    return (
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <div className={cn("flex flex-col gap-1.5", className)}>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor={name}>{label}</Label>
              <Switch
                id={name}
                checked={field.value === true}
                onCheckedChange={field.onChange}
                onBlur={field.onBlur}
                disabled={disabled}
                aria-describedby={described(error, description, footerId)}
              />
            </div>
            <FieldFooter
              error={error}
              description={description}
              id={footerId}
            />
          </div>
        )}
      />
    );
  }
  SwitchField.displayName = `${prefix}SwitchField`;

  /** A one-time code: one box per digit; pasting the whole code works. */
  function OtpField({
    name,
    label,
    description,
    className,
    disabled,
    length = 6,
    autoFocus,
  }: OtpFieldProps) {
    const { control, error, footerId } = useFieldState(name);
    return (
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <div className={cn("flex flex-col gap-1.5", className)}>
            <Label htmlFor={name}>{label}</Label>
            <InputOTP
              id={name}
              maxLength={length}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="^[0-9]+$"
              autoFocus={autoFocus}
              disabled={disabled}
              value={field.value ?? ""}
              onChange={field.onChange}
              onBlur={field.onBlur}
              aria-invalid={error ? true : undefined}
              aria-describedby={described(error, description, footerId)}
            >
              <InputOTPGroup>
                {Array.from({ length }, (_, index) => (
                  <InputOTPSlot
                    key={index}
                    index={index}
                    aria-invalid={error ? true : undefined}
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
            <FieldFooter
              error={error}
              description={description}
              id={footerId}
            />
          </div>
        )}
      />
    );
  }
  OtpField.displayName = `${prefix}OtpField`;

  return {
    InputField,
    TextareaField,
    SelectField,
    CheckboxField,
    CheckboxGroupField,
    SwitchField,
    OtpField,
  };
}
