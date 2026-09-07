import Link from "next/link";
import { prisma } from "@hostpanel/db";
import { format } from "@hostpanel/shared/money";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireClientActor } from "@/lib/session";

export default async function PortalDashboardPage() {
  const actor = await requireClientActor();
  const client = await prisma.client.findUniqueOrThrow({ where: { id: actor.clientId } });
  const unpaidInvoices = await prisma.invoice.findMany({
    where: { clientId: actor.clientId, status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] } },
    orderBy: { dueDate: "asc" },
  });
  const recentOrders = await prisma.order.findMany({
    where: { clientId: actor.clientId },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back, {client.firstName}</h1>
        <p className="text-muted-foreground">Here&apos;s what&apos;s happening with your account.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Account credit</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {format({ amount: client.creditBalance, currency: client.currency })}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Unpaid invoices</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{unpaidInvoices.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Account status</CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant={client.status === "ACTIVE" ? "default" : "destructive"}>{client.status}</Badge>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Unpaid invoices</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {unpaidInvoices.length === 0 && (
            <p className="text-sm text-muted-foreground">You&apos;re all caught up.</p>
          )}
          {unpaidInvoices.map((invoice) => (
            <Link
              key={invoice.id}
              href={`/portal/invoices/${invoice.id}`}
              className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-muted"
            >
              <span>{invoice.invoiceNumber}</span>
              <span>{format({ amount: invoice.amountDue, currency: invoice.currency })}</span>
              <Badge variant="outline">{invoice.status}</Badge>
            </Link>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent orders</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {recentOrders.length === 0 && <p className="text-sm text-muted-foreground">No orders yet.</p>}
          {recentOrders.map((order) => (
            <Link
              key={order.id}
              href={`/portal/orders/${order.id}`}
              className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-muted"
            >
              <span>{order.orderNumber}</span>
              <span>{format({ amount: order.total, currency: order.currency })}</span>
              <Badge variant="outline">{order.status}</Badge>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
