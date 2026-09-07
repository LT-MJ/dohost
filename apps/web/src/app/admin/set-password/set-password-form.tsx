"use client";

import { useActionState } from "react";
import Link from "next/link";
import { staffSetPasswordAction, type ActionState } from "@/lib/actions/auth";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: ActionState = {};

export function SetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState(staffSetPasswordAction, initialState);

  if (state.success) {
    return (
      <div className="space-y-4">
        <FormMessage success={state.success} />
        <Link href="/admin/login" className="text-sm underline underline-offset-4">
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <FormMessage error={state.error} />
      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required />
      </div>
      <SubmitButton className="w-full" pendingText="Saving…">
        Set password
      </SubmitButton>
    </form>
  );
}
