"use client";

import { useActionState } from "react";
import { createProductAction, createProductGroupAction, type ActionState } from "@/lib/actions/admin";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialState: ActionState = {};

export function CreateGroupForm() {
  const [state, action] = useActionState(createProductGroupAction, initialState);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-3 sm:items-end">
      <div className="space-y-2">
        <Label htmlFor="groupName">Name</Label>
        <Input id="groupName" name="name" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="groupSlug">Slug</Label>
        <Input id="groupSlug" name="slug" required />
      </div>
      <SubmitButton pendingText="Creating…">Create group</SubmitButton>
      <div className="sm:col-span-3">
        <FormMessage error={state.error} success={state.success} />
      </div>
    </form>
  );
}

export function CreateProductForm({ groups }: { groups: { id: string; name: string }[] }) {
  const [state, action] = useActionState(createProductAction, initialState);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-3">
      <div className="space-y-2">
        <Label htmlFor="productGroupId">Group</Label>
        <Select name="productGroupId" defaultValue={groups[0]?.id}>
          <SelectTrigger id="productGroupId" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {groups.map((group) => (
              <SelectItem key={group.id} value={group.id}>
                {group.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="productName">Name</Label>
        <Input id="productName" name="name" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="productSlug">Slug</Label>
        <Input id="productSlug" name="slug" required />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="description">Description</Label>
        <Input id="description" name="description" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="monthlyPrice">Monthly price (USD)</Label>
        <Input id="monthlyPrice" name="monthlyPrice" placeholder="19.99" />
      </div>
      <div className="sm:col-span-3">
        <FormMessage error={state.error} success={state.success} />
      </div>
      <SubmitButton pendingText="Creating…">Create product</SubmitButton>
    </form>
  );
}
