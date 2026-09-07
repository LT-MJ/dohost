import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-24 text-center">
      <div className="space-y-4">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">HostPanel</h1>
        <p className="mx-auto max-w-xl text-balance text-muted-foreground">
          Hosting, domains, billing, and client management — in one place.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button render={<Link href="/register" />} size="lg">
          Create an account
        </Button>
        <Button render={<Link href="/login" />} size="lg" variant="outline">
          Client sign in
        </Button>
      </div>
      <Link href="/admin/login" className="text-sm text-muted-foreground underline underline-offset-4">
        Staff sign in
      </Link>
    </main>
  );
}
