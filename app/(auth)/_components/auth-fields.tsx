"use client";

import { useState } from "react";
import { EyeIcon, EyeOffIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function Field({
  label,
  hint,
  children,
}: {
  readonly label: string;
  readonly hint?: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label>{label}</Label>
        {hint ? <span className="text-muted-foreground text-xs">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

export function PasswordInput({
  name,
  autoComplete,
  placeholder = "••••••••",
  className,
}: {
  readonly name: string;
  readonly autoComplete: string;
  readonly placeholder?: string;
  readonly className?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        autoComplete={autoComplete}
        className={cn("h-10 pr-10", className)}
        name={name}
        placeholder={placeholder}
        required
        type={visible ? "text" : "password"}
      />
      <button
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        type="button"
      >
        {visible ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
      </button>
    </div>
  );
}

/**
 * A plain HTML post form with its own pending state.
 *
 * The button must NOT disable itself from its own `onClick`: React applies that
 * DOM update before the browser runs the submit action, and a disabled button
 * has no activation behavior, so the form never posts. Flipping the flag in the
 * form's `onSubmit` is safe — submission is already under way by then.
 */
export function AuthForm({
  action,
  submitLabel,
  children,
}: {
  readonly action: string;
  readonly submitLabel: string;
  readonly children: React.ReactNode;
}) {
  const [pending, setPending] = useState(false);

  return (
    <form
      action={action}
      className="space-y-4"
      method="post"
      onSubmit={() => setPending(true)}
    >
      {children}
      <button
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary font-medium text-primary-foreground text-sm shadow-xs transition-all hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-70"
        disabled={pending}
        type="submit"
      >
        {pending ? (
          <span className="size-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
        ) : null}
        {submitLabel}
      </button>
    </form>
  );
}
