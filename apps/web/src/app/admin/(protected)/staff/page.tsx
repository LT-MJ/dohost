import { hasPermission } from "@hostpanel/auth/rbac";
import { prisma } from "@hostpanel/db";
import { PERMISSIONS } from "@hostpanel/shared/permissions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireStaffActor } from "@/lib/session";
import { CreateStaffForm } from "./staff-forms";

export default async function AdminStaffPage() {
  const actor = await requireStaffActor();
  const staff = await prisma.staffUser.findMany({
    where: { deletedAt: null },
    include: { role: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Staff</h1>

      {hasPermission(actor, PERMISSIONS.STAFF_MANAGE) && (
        <Card>
          <CardHeader>
            <CardTitle>Invite a staff member</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateStaffForm />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>2FA</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.role.name}</TableCell>
                  <TableCell>
                    <Badge variant={user.status === "ACTIVE" ? "default" : "outline"}>{user.status}</Badge>
                  </TableCell>
                  <TableCell>{user.twoFactorEnabled ? "On" : "Off"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
