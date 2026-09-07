import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormMessage } from "@/components/form-message";
import { SetPasswordForm } from "./set-password-form";

export default async function StaffSetPasswordPage({ searchParams }: PageProps<"/admin/set-password">) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : undefined;

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Activate your staff account</CardTitle>
          <CardDescription>Set a password to finish activating your account.</CardDescription>
        </CardHeader>
        <CardContent>
          {token ? <SetPasswordForm token={token} /> : <FormMessage error="This link is missing its token." />}
        </CardContent>
      </Card>
    </main>
  );
}
