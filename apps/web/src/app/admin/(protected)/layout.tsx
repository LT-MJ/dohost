import { staffLogoutAction } from "@/lib/actions/auth";
import { NavShell } from "@/components/nav-shell";
import { Button } from "@/components/ui/button";
import { requireStaffActor } from "@/lib/session";

const LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/clients", label: "Clients" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/invoices", label: "Invoices" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/staff", label: "Staff" },
  { href: "/admin/audit", label: "Audit log" },
  { href: "/admin/settings", label: "Settings" },
];

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const actor = await requireStaffActor();

  return (
    <NavShell
      brand="HostPanel Admin"
      brandHref="/admin"
      links={LINKS}
      actions={
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{actor.label}</span>
          <form action={staffLogoutAction}>
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      }
    >
      {children}
    </NavShell>
  );
}
