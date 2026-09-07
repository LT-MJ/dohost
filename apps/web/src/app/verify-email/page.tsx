import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormMessage } from "@/components/form-message";
import { verifyEmailAction } from "@/lib/actions/auth";

export default async function VerifyEmailPage({ searchParams }: PageProps<"/verify-email">) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : undefined;

  const result = token
    ? await verifyEmailAction(token)
    : { error: "This link is missing its verification token." };

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Verify your email</CardTitle>
          <CardDescription>Confirming your address for HostPanel.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {result.error ? (
            <FormMessage error={result.error} />
          ) : (
            <FormMessage success="Your email is verified. You can now sign in." />
          )}
          <Button render={<Link href="/login" />} className="w-full">
            Go to sign in
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
