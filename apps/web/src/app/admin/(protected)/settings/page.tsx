import { hasPermission } from "@hostpanel/auth/rbac";
import { getCompanyProfile } from "@hostpanel/core";
import { PERMISSIONS } from "@hostpanel/shared/permissions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireStaffActor } from "@/lib/session";
import { CompanyProfileForm } from "./settings-form";

export default async function AdminSettingsPage() {
  const actor = await requireStaffActor();

  if (!hasPermission(actor, PERMISSIONS.SETTINGS_MANAGE)) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Access denied</AlertTitle>
        <AlertDescription>You don&apos;t have permission to manage settings.</AlertDescription>
      </Alert>
    );
  }

  const profile = await getCompanyProfile(actor.tenantId);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <Card>
        <CardHeader>
          <CardTitle>Company profile</CardTitle>
        </CardHeader>
        <CardContent>
          <CompanyProfileForm profile={profile} />
        </CardContent>
      </Card>
    </div>
  );
}
