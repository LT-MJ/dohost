"use client";

import { useActionState } from "react";
import { updateProfileAction, type ActionState } from "@/lib/actions/profile";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Client } from "@hostpanel/db";

const initialState: ActionState = {};

export function ProfileForm({ client }: { client: Client }) {
  const [state, action] = useActionState(updateProfileAction, initialState);

  return (
    <form action={action} className="max-w-lg space-y-4">
      <FormMessage error={state.error} success={state.success} />
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">First name</Label>
          <Input id="firstName" name="firstName" defaultValue={client.firstName} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last name</Label>
          <Input id="lastName" name="lastName" defaultValue={client.lastName} required />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="companyName">Company name</Label>
        <Input id="companyName" name="companyName" defaultValue={client.companyName ?? ""} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" name="phone" defaultValue={client.phone ?? ""} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="addressLine1">Address</Label>
        <Input id="addressLine1" name="addressLine1" defaultValue={client.addressLine1 ?? ""} />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input id="city" name="city" defaultValue={client.city ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="state">State</Label>
          <Input id="state" name="state" defaultValue={client.state ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="postalCode">Postal code</Label>
          <Input id="postalCode" name="postalCode" defaultValue={client.postalCode ?? ""} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="country">Country</Label>
        <Input id="country" name="country" defaultValue={client.country ?? ""} />
      </div>
      <SubmitButton pendingText="Saving…">Save changes</SubmitButton>
    </form>
  );
}
