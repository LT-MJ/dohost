import Link from "next/link";
import { prisma } from "@hostpanel/db";
import { format } from "@hostpanel/shared/money";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { requireClientActor } from "@/lib/session";

export default async function OrdersPage() {
  const actor = await requireClientActor();
  const orders = await prisma.order.findMany({
    where: { clientId: actor.clientId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
      <Card>
        <CardContent className="space-y-2 p-4">
          {orders.length === 0 && <p className="text-sm text-muted-foreground">No orders yet.</p>}
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/portal/orders/${order.id}`}
              className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-muted"
            >
              <span>{order.orderNumber}</span>
              <span className="text-muted-foreground">{order.createdAt.toLocaleDateString()}</span>
              <span>{format({ amount: order.total, currency: order.currency })}</span>
              <Badge variant="outline">{order.status}</Badge>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
