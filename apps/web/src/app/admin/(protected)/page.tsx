import Link from "next/link";
import { prisma } from "@hostpanel/db";
import { format, sum } from "@hostpanel/shared/money";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireStaffActor } from "@/lib/session";

function sevenDaysAgo(): Date {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
}

export default async function AdminDashboardPage() {
  await requireStaffActor();

  const weekAgo = sevenDaysAgo();
  const [totalClients, newClients, newOrders, unpaidInvoices, recentOrders] = await Promise.all([
    prisma.client.count(),
    prisma.client.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.order.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.invoice.findMany({ where: { status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] } } }),
    prisma.order.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { client: true } }),
  ]);

  const unpaidTotal =
    unpaidInvoices.length > 0
      ? sum(
          unpaidInvoices[0]!.currency,
          unpaidInvoices.map((i) => ({ amount: i.amountDue, currency: i.currency })),
        )
      : { amount: 0, currency: "USD" };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total clients</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{totalClients}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>New clients (7d)</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{newClients}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>New orders (7d)</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{newOrders}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Outstanding invoices</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {unpaidInvoices.length} · {format(unpaidTotal)}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent orders</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {recentOrders.length === 0 && <p className="text-sm text-muted-foreground">No orders yet.</p>}
          {recentOrders.map((order) => (
            <Link
              key={order.id}
              href={`/admin/orders/${order.id}`}
              className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-muted"
            >
              <span>{order.orderNumber}</span>
              <span className="text-muted-foreground">
                {order.client.companyName || `${order.client.firstName} ${order.client.lastName}`}
              </span>
              <span>{format({ amount: order.total, currency: order.currency })}</span>
              <Badge variant="outline">{order.status}</Badge>
            </Link>
          ))}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Revenue, MRR/ARR, dunning, domain renewals, ticket, and server-health widgets light up as the
        billing, domains, and support phases land — see ARCHITECTURE.md for the roadmap.
      </p>
    </div>
  );
}
