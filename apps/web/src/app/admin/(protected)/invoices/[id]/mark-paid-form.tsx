"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { markInvoicePaidAction, type ActionState } from "@/lib/actions/admin";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: ActionState = {};

export function MarkPaidForm({ invoiceId, amountDueDecimal }: { invoiceId: string; amountDueDecimal: string }) {
  const [state, action] = useActionState(markInvoicePaidAction, initialState);

  // A fully-paid invoice stops rendering this form on the next server
  // re-fetch (revalidatePath), which can remove it before the inline
  // success message is visible — a toast survives that unmount.
  useEffect(() => {
    if (state.success) toast.success(state.success);
  }, [state.success]);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <FormMessage error={state.error} success={state.success} />
      <div className="space-y-2">
        <Label htmlFor="amount">Amount received (USD)</Label>
        <Input id="amount" name="amount" defaultValue={amountDueDecimal} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="reference">Reference (optional)</Label>
        <Input id="reference" name="reference" placeholder="Bank transfer ID" />
      </div>
      <SubmitButton pendingText="Recording…">Record payment</SubmitButton>
    </form>
  );
}
