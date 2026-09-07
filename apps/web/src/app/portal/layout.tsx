import { AlertTriangleIcon } from "lucide-react";
import { logoutAction } from "@/lib/actions/auth";
import { NavShell } from "@/components/nav-shell";
import { Button } from "@/components/ui/button";
import { isImpersonating, requireClientActor } from "@/lib/session";

const LINKS = [
  { href: "/portal", label: "Dashboard" },
  { href: "/portal/products", label: "Products" },
  { href: "/portal/orders", label: "Orders" },
  { href: "/portal/profile", label: "Profile" },
];

export default async function PortalLayout({ children }: LayoutProps<"/portal">) {
  await requireClientActor();
  const impersonating = await isImpersonating();

  return (
    <NavShell
      brand="HostPanel"
      brandHref="/portal"
      links={LINKS}
      banner={
        impersonating ? (
          <div className="flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950">
            <AlertTriangleIcon className="size-4" />
            A staff member is viewing this account on the client&apos;s behalf.
          </div>
        ) : undefined
      }
      actions={
        <form action={logoutAction}>
          <Button type="submit" variant="outline" size="sm">
            Sign out
          </Button>
        </form>
      }
    >
      {children}
    </NavShell>
  );
}
