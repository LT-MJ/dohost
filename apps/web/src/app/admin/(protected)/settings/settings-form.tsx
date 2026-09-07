"use client";

import { useActionState } from "react";
import { updateCompanyProfileAction, type ActionState } from "@/lib/actions/admin";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CompanyProfile } from "@hostpanel/core";

const initialState: ActionState = {};

export function CompanyProfileForm({ profile }: { profile: CompanyProfile }) {
  const [state, action] = useActionState(updateCompanyProfileAction, initialState);

  return (
    <form action={action} className="max-w-lg space-y-4">
      <FormMessage error={state.error} success={state.success} />
      <div className="space-y-2">
        <Label htmlFor="name">Company name</Label>
        <Input id="name" name="name" defaultValue={profile.name} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="addressLine1">Address</Label>
        <Input id="addressLine1" name="addressLine1" defaultValue={profile.addressLine1 ?? ""} />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input id="city" name="city" defaultValue={profile.city ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="state">State</Label>
          <Input id="state" name="state" defaultValue={profile.state ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="postalCode">Postal code</Label>
          <Input id="postalCode" name="postalCode" defaultValue={profile.postalCode ?? ""} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="country">Country</Label>
        <Input id="country" name="country" defaultValue={profile.country ?? ""} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="taxId">Tax ID</Label>
        <Input id="taxId" name="taxId" defaultValue={profile.taxId ?? ""} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="supportEmail">Support email</Label>
        <Input id="supportEmail" name="supportEmail" type="email" defaultValue={profile.supportEmail ?? ""} />
      </div>
      <SubmitButton pendingText="Saving…">Save settings</SubmitButton>
    </form>
  );
}
