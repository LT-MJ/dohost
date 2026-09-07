"use client";

import { useActionState } from "react";
import Link from "next/link";
import { clientLoginAction, type ActionState } from "@/lib/actions/auth";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: ActionState = {};

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(clientLoginAction, initialState);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <FormMessage error={state.error} />
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="totpToken">2FA code (if enabled)</Label>
        <Input id="totpToken" name="totpToken" inputMode="numeric" autoComplete="one-time-code" />
      </div>
      <SubmitButton className="w-full" pendingText="Signing in…">
        Sign in
      </SubmitButton>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <Link href="/reset-password" className="underline underline-offset-4">
          Forgot password?
        </Link>
        <Link href="/register" className="underline underline-offset-4">
          Create an account
        </Link>
      </div>
    </form>
  );
}
