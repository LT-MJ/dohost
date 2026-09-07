import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@hostpanel/db";
import { format } from "@hostpanel/shared/money";
import { PERMISSIONS } from "@hostpanel/shared/permissions";
import { hasPermission } from "@hostpanel/auth/rbac";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireStaffActor } from "@/lib/session";
import { AddNoteForm, ChangeStatusForm } from "./client-forms";

export default async function AdminClientDetailPage({ params }: PageProps<"/admin/clients/[id]">) {
  const { id } = await params;
  const actor = await requireStaffActor();
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      notes: { orderBy: { createdAt: "desc" } },
      orders: { orderBy: { createdAt: "desc" }, take: 10 },
      invoices: { orderBy: { createdAt: "desc" }, take: 10 },
      contacts: true,
    },
  });
  if (!client) notFound();

  const canWrite = hasPermission(actor, PERMISSIONS.CLIENTS_WRITE);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {client.companyName || `${client.firstName} ${client.lastName}`}
          </h1>
          <p className="text-muted-foreground">{client.email}</p>
        </div>
        <Badge variant={client.status === "ACTIVE" ? "default" : "outline"}>{client.status}</Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Orders</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {client.orders.length === 0 && <p className="text-sm text-muted-foreground">No orders.</p>}
              {client.orders.map((order) => (
                <Link
                  key={order.id}
                  href={`/admin/orders/${order.id}`}
                  className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-muted"
                >
                  <span>{order.orderNumber}</span>
                  <span>{format({ amount: order.total, currency: order.currency })}</span>
                  <Badge variant="outline">{order.status}</Badge>
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Invoices</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {client.invoices.length === 0 && <p className="text-sm text-muted-foreground">No invoices.</p>}
              {client.invoices.map((invoice) => (
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

          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {canWrite && <AddNoteForm clientId={client.id} />}
              <div className="space-y-2">
                {client.notes.map((note) => (
                  <div key={note.id} className="rounded-md border p-3 text-sm">
                    <p>{note.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {note.authorLabel} · {note.createdAt.toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>Type: {client.type}</p>
              <p>Currency: {client.currency}</p>
              <p>Country: {client.country ?? "—"}</p>
              <p>Credit: {format({ amount: client.creditBalance, currency: client.currency })}</p>
              <p>Risk: {client.riskStatus}</p>
              <p>Verification: {client.verificationStatus}</p>
              <p>Contacts: {client.contacts.length}</p>
            </CardContent>
          </Card>

          {canWrite && (
            <Card>
              <CardHeader>
                <CardTitle>Change status</CardTitle>
              </CardHeader>
              <CardContent>
                <ChangeStatusForm clientId={client.id} currentStatus={client.status} />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
