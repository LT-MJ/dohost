import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StaffConsumeResetForm, StaffRequestResetForm } from "./reset-password-forms";

export default async function StaffResetPasswordPage({ searchParams }: PageProps<"/admin/reset-password">) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : undefined;

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Reset your password</CardTitle>
          <CardDescription>
            {token ? "Choose a new password." : "We'll email you a link to reset your password."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {token ? <StaffConsumeResetForm token={token} /> : <StaffRequestResetForm />}
        </CardContent>
      </Card>
    </main>
  );
}
