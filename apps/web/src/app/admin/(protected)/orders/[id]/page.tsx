import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@hostpanel/db";
import { format } from "@hostpanel/shared/money";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireStaffActor } from "@/lib/session";

export default async function AdminOrderDetailPage({ params }: PageProps<"/admin/orders/[id]">) {
  const { id } = await params;
  await requireStaffActor();
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true, invoices: true, client: true },
  });
  if (!order) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Order {order.orderNumber}</h1>
          <Link href={`/admin/clients/${order.clientId}`} className="text-muted-foreground hover:underline">
            {order.client.companyName || `${order.client.firstName} ${order.client.lastName}`}
          </Link>
        </div>
        <Badge variant="outline">{order.status}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Cycle</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.productNameSnapshot}</TableCell>
                  <TableCell>{item.billingCycleSnapshot}</TableCell>
                  <TableCell className="text-right">
                    {format({ amount: item.lineTotal, currency: order.currency })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="mt-4 flex justify-end text-lg font-semibold">
            Total: {format({ amount: order.total, currency: order.currency })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {order.invoices.length === 0 && <p className="text-sm text-muted-foreground">No invoice yet.</p>}
          {order.invoices.map((invoice) => (
            <Link
              key={invoice.id}
              href={`/admin/invoices/${invoice.id}`}
              className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-muted"
            >
              <span>{invoice.invoiceNumber}</span>
              <span>{format({ amount: invoice.amountDue, currency: invoice.currency })} due</span>
              <Badge variant="outline">{invoice.status}</Badge>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
