import Link from "next/link";
import { isSetupComplete } from "@hostpanel/core";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SetupForm } from "./setup-form";

// Reflects live database state (has setup already run?) on every request —
// must never be statically prerendered, at build time or otherwise.
export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const alreadyComplete = await isSetupComplete();

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{alreadyComplete ? "Setup already completed" : "Create the first admin account"}</CardTitle>
          <CardDescription>
            {alreadyComplete
              ? "A staff account already exists for this deployment."
              : "One-time setup for a fresh deployment. This form stops working the moment an account exists."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {alreadyComplete ? (
            <Link href="/admin/login" className="text-sm text-muted-foreground underline underline-offset-4">
              Go to sign in
            </Link>
          ) : (
            <SetupForm />
          )}
        </CardContent>
      </Card>
    </main>
  );
}
