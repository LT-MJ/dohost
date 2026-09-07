import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface NavLink {
  href: string;
  label: string;
}

export function NavShell({
  brand,
  brandHref,
  links,
  actions,
  banner,
  children,
}: {
  brand: string;
  brandHref: string;
  links: NavLink[];
  actions?: ReactNode;
  banner?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col">
      {banner}
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
          <Link href={brandHref} className="font-semibold tracking-tight">
            {brand}
          </Link>
          <nav className="flex flex-1 items-center gap-4 text-sm text-muted-foreground">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className={cn("hover:text-foreground")}>
                {link.label}
              </Link>
            ))}
          </nav>
          {actions}
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
