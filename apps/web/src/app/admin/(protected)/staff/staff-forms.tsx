"use client";

import { useActionState } from "react";
import { createStaffUserAction, type ActionState } from "@/lib/actions/admin";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STAFF_ROLE_KEYS, STAFF_ROLE_LABELS } from "@hostpanel/shared/permissions";

const initialState: ActionState = {};

export function CreateStaffForm() {
  const [state, action] = useActionState(createStaffUserAction, initialState);

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-4 sm:items-end">
      <div className="space-y-2 sm:col-span-1">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required />
      </div>
      <div className="space-y-2 sm:col-span-1">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div className="space-y-2 sm:col-span-1">
        <Label htmlFor="roleKey">Role</Label>
        <Select name="roleKey" defaultValue="support_staff">
          <SelectTrigger id="roleKey" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STAFF_ROLE_KEYS.map((key) => (
              <SelectItem key={key} value={key}>
                {STAFF_ROLE_LABELS[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <SubmitButton pendingText="Inviting…">Invite staff member</SubmitButton>
      <div className="sm:col-span-4">
        <FormMessage error={state.error} success={state.success} />
      </div>
    </form>
  );
}
