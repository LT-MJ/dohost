import { hasPermission } from "@hostpanel/auth/rbac";
import { prisma } from "@hostpanel/db";
import { PERMISSIONS } from "@hostpanel/shared/permissions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireStaffActor } from "@/lib/session";

export default async function AdminAuditPage() {
  const actor = await requireStaffActor();

  if (!hasPermission(actor, PERMISSIONS.AUDIT_READ)) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Access denied</AlertTitle>
        <AlertDescription>You don&apos;t have permission to view the audit log.</AlertDescription>
      </Alert>
    );
  }

  const entries = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 200 });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {entry.createdAt.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-xs">{entry.actorLabel ?? entry.actorType}</TableCell>
                  <TableCell className="text-xs">{entry.action}</TableCell>
                  <TableCell className="text-xs">
                    {entry.entityType} · {entry.entityId.slice(0, 8)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{entry.reason ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
