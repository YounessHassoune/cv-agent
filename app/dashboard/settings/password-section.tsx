"use client";

import { CheckIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SettingsSection } from "./settings-section";

/**
 * Sets a first password (Google-only accounts) or rotates an existing one.
 * The current password is required whenever one is already set.
 */
export function PasswordSection({ hasPassword }: { readonly hasPassword: boolean }) {
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState<string>();

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    setStatus("saving");
    setMessage(undefined);

    const response = await fetch("/api/auth/password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        currentPassword: String(data.get("currentPassword") ?? ""),
        newPassword: String(data.get("newPassword") ?? ""),
      }),
    });

    if (response.ok) {
      setStatus("saved");
      form.reset();
      return;
    }

    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    setStatus("error");
    setMessage(body?.error ?? `Could not update the password (${response.status}).`);
  };

  return (
    <SettingsSection
      description={
        hasPassword
          ? "You'll stay signed in on this device."
          : "Add a password so you can sign in without Google."
      }
      title={hasPassword ? "Change password" : "Set a password"}
    >
      <form className="grid gap-4 md:grid-cols-2" onSubmit={submit}>
        {hasPassword ? (
          <div className="space-y-1.5">
            <Label className="text-xs">Current password</Label>
            <Input
              autoComplete="current-password"
              name="currentPassword"
              placeholder="••••••••"
              required
              type="password"
            />
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label className="text-xs">New password</Label>
          <Input
            autoComplete="new-password"
            name="newPassword"
            placeholder="••••••••"
            required
            type="password"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 md:col-span-2">
          <Button className="px-5" disabled={status === "saving"} type="submit">
            {status === "saving" ? "Saving…" : "Update password"}
          </Button>
          {status === "saved" ? (
            <span className="flex items-center gap-1.5 text-sm text-success">
              <CheckIcon className="size-3.5" /> Password updated.
            </span>
          ) : null}
          {status === "error" ? <span className="text-destructive text-sm">{message}</span> : null}
        </div>
      </form>
    </SettingsSection>
  );
}
