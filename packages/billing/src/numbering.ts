import type { Prisma } from "@hostpanel/db";

/**
 * Atomically increments a per-tenant named counter and formats it. Must be
 * called inside the same transaction as the record it numbers — the
 * increment is a single `UPDATE ... SET value = value + 1` under the
 * transaction's row lock, so two concurrent order/invoice creations can
 * never be handed the same number.
 */
export async function nextSequenceNumber(
  tx: Prisma.TransactionClient,
  tenantId: string,
  key: string,
  options: { prefix: string; padding: number },
): Promise<string> {
  const counter = await tx.counter.upsert({
    where: { tenantId_key: { tenantId, key } },
    create: { tenantId, key, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `${options.prefix}${String(counter.value).padStart(options.padding, "0")}`;
}
