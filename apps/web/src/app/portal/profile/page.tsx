import { prisma } from "@hostpanel/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireClientActor } from "@/lib/session";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const actor = await requireClientActor();
  const client = await prisma.client.findUniqueOrThrow({ where: { id: actor.clientId } });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
      <Card>
        <CardHeader>
          <CardTitle>Account details</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm client={client} />
        </CardContent>
      </Card>
    </div>
  );
}
