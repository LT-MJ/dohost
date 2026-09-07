"use client";

import { useActionState } from "react";
import { addClientNoteAction, changeClientStatusAction, type ActionState } from "@/lib/actions/admin";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ClientStatus } from "@hostpanel/db";

const initialState: ActionState = {};

const STATUSES: ClientStatus[] = ["ACTIVE", "SUSPENDED", "CLOSED"];

export function ChangeStatusForm({ clientId, currentStatus }: { clientId: string; currentStatus: ClientStatus }) {
  const [state, action] = useActionState(changeClientStatusAction, initialState);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="clientId" value={clientId} />
      <FormMessage error={state.error} success={state.success} />
      <div className="space-y-2">
        <Label htmlFor="status">New status</Label>
        <Select name="status" defaultValue={currentStatus}>
          <SelectTrigger id="status" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="reason">Reason</Label>
        <Input id="reason" name="reason" placeholder="Required for audit trail" required />
      </div>
      <SubmitButton size="sm" pendingText="Saving…">
        Update status
      </SubmitButton>
    </form>
  );
}

export function AddNoteForm({ clientId }: { clientId: string }) {
  const [state, action] = useActionState(addClientNoteAction, initialState);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="clientId" value={clientId} />
      <FormMessage error={state.error} success={state.success} />
      <Textarea name="body" placeholder="Add a note visible only to staff…" required rows={3} />
      <SubmitButton size="sm" pendingText="Saving…">
        Add note
      </SubmitButton>
    </form>
  );
}
