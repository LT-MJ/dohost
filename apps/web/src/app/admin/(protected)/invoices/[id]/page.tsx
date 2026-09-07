import Link from "next/link";
import { notFound } from "next/navigation";
import { hasPermission } from "@hostpanel/auth/rbac";
import { prisma } from "@hostpanel/db";
import { format, toDecimalString } from "@hostpanel/shared/money";
import { PERMISSIONS } from "@hostpanel/shared/permissions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireStaffActor } from "@/lib/session";
import { MarkPaidForm } from "./mark-paid-form";

const PAYABLE_STATUSES = new Set(["ISSUED", "PARTIALLY_PAID", "OVERDUE"]);

export default async function AdminInvoiceDetailPage({ params }: PageProps<"/admin/invoices/[id]">) {
  const { id } = await params;
  const actor = await requireStaffActor();
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { items: true, client: true },
  });
  if (!invoice) notFound();

  const canWrite = hasPermission(actor, PERMISSIONS.INVOICES_WRITE);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Invoice {invoice.invoiceNumber}</h1>
          <Link href={`/admin/clients/${invoice.clientId}`} className="text-muted-foreground hover:underline">
            {invoice.client.companyName || `${invoice.client.firstName} ${invoice.client.lastName}`}
          </Link>
        </div>
        <Badge variant="outline">{invoice.status}</Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Items</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.description}</TableCell>
                      <TableCell className="text-right">
                        {format({ amount: item.lineTotal, currency: invoice.currency })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-4 space-y-1 text-right text-sm">
                <p className="text-lg font-semibold">
                  Total: {format({ amount: invoice.total, currency: invoice.currency })}
                </p>
                <p className="text-muted-foreground">
                  Paid: {format({ amount: invoice.amountPaid, currency: invoice.currency })}
                </p>
                <p className="font-medium">
                  Due: {format({ amount: invoice.amountDue, currency: invoice.currency })}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {canWrite && PAYABLE_STATUSES.has(invoice.status) && (
          <Card>
            <CardHeader>
              <CardTitle>Record payment</CardTitle>
            </CardHeader>
            <CardContent>
              <MarkPaidForm
                invoiceId={invoice.id}
                amountDueDecimal={toDecimalString({ amount: invoice.amountDue, currency: invoice.currency })}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
