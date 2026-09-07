"use client";

import { useActionState } from "react";
import { placeOrderAction, type ActionState } from "@/lib/actions/orders";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";

const initialState: ActionState = {};

export function OrderForm({ productId, label }: { productId: string; label: string }) {
  const [state, action] = useActionState(placeOrderAction, initialState);

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="billingCycle" value="MONTHLY" />
      <FormMessage error={state.error} />
      <SubmitButton className="w-full" pendingText="Placing order…">
        {label}
      </SubmitButton>
    </form>
  );
}
