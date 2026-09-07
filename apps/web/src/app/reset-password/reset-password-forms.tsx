"use client";

import { useActionState } from "react";
import {
  requestClientPasswordResetAction,
  resetClientPasswordAction,
  type ActionState,
} from "@/lib/actions/auth";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: ActionState = {};

export function RequestResetForm() {
  const [state, action] = useActionState(requestClientPasswordResetAction, initialState);
  if (state.success) return <FormMessage success={state.success} />;

  return (
    <form action={action} className="space-y-4">
      <FormMessage error={state.error} />
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <SubmitButton className="w-full" pendingText="Sending…">
        Send reset link
      </SubmitButton>
    </form>
  );
}

export function ConsumeResetForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetClientPasswordAction, initialState);
  if (state.success) return <FormMessage success={state.success} />;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <FormMessage error={state.error} />
      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required />
      </div>
      <SubmitButton className="w-full" pendingText="Updating…">
        Update password
      </SubmitButton>
    </form>
  );
}
