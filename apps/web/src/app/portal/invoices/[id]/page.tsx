import { notFound } from "next/navigation";
import { prisma } from "@hostpanel/db";
import { format } from "@hostpanel/shared/money";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireClientActor } from "@/lib/session";

const PAYABLE_STATUSES = new Set(["ISSUED", "PARTIALLY_PAID", "OVERDUE"]);

export default async function InvoiceDetailPage({ params }: PageProps<"/portal/invoices/[id]">) {
  const { id } = await params;
  const actor = await requireClientActor();
  const invoice = await prisma.invoice.findUnique({ where: { id }, include: { items: true } });
  if (!invoice || invoice.clientId !== actor.clientId) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Invoice {invoice.invoiceNumber}</h1>
        <Badge variant="outline">{invoice.status}</Badge>
      </div>

      {PAYABLE_STATUSES.has(invoice.status) && (
        <Alert>
          <AlertTitle>Payment due {invoice.dueDate.toLocaleDateString()}</AlertTitle>
          <AlertDescription>
            This invoice is payable by bank transfer. Reference invoice{" "}
            <strong>{invoice.invoiceNumber}</strong> and contact support once you&apos;ve sent payment —
            our team will confirm it on your account.
          </AlertDescription>
        </Alert>
      )}

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
            <p>Subtotal: {format({ amount: invoice.subtotal, currency: invoice.currency })}</p>
            <p>Tax: {format({ amount: invoice.taxTotal, currency: invoice.currency })}</p>
            <p className="text-lg font-semibold">
              Total: {format({ amount: invoice.total, currency: invoice.currency })}
            </p>
            <p className="text-muted-foreground">
              Paid: {format({ amount: invoice.amountPaid, currency: invoice.currency })}
            </p>
            <p className="font-medium">
              Amount due: {format({ amount: invoice.amountDue, currency: invoice.currency })}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
