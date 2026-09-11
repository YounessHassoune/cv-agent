import { Input } from "@/components/ui/input";
import { AuthForm, Field } from "./auth-fields";

/**
 * Asks for a fresh verification link. The address is editable only when the
 * page was reached without one, so the common case is a single button.
 */
export function ResendForm({ email }: { readonly email?: string }) {
  return (
    <AuthForm action="/api/auth/verify/resend" submitLabel="Send a new link">
      {email ? (
        <input name="email" type="hidden" value={email} />
      ) : (
        <Field label="Email">
          <Input
            autoComplete="email"
            className="h-10"
            name="email"
            placeholder="you@example.com"
            required
            type="email"
          />
        </Field>
      )}
    </AuthForm>
  );
}
