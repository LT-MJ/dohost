import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StaffLoginForm } from "./login-form";

export default async function StaffLoginPage({ searchParams }: PageProps<"/admin/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "/admin";

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Staff sign in</CardTitle>
          <CardDescription>HostPanel admin area.</CardDescription>
        </CardHeader>
        <CardContent>
          <StaffLoginForm next={next} />
        </CardContent>
      </Card>
    </main>
  );
}
