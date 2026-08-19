"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { AccountMenu } from "@/components/auth/account-menu";
import { useAuthSession } from "@/components/auth/auth-session-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const coreNavigation = [
  { href: "/research", label: "Research" },
  { href: "/compare", label: "Compare" },
  { href: "/guide", label: "Guide" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { state: authState } = useAuthSession();
  const navigation = authState.status === "signed-in"
    ? [...coreNavigation, { href: "/saved", label: "Saved" }]
    : coreNavigation;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-white">
      <div className="mx-auto flex h-[72px] w-full max-w-[1440px] items-center px-5 sm:px-8 lg:px-14">
        <Link
          href="/"
          className="rounded-sm text-[22px] font-bold tracking-tight text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          UniProof
        </Link>

        <nav className="ml-auto hidden md:block" aria-label="Primary navigation">
          <ul className="flex items-center gap-10 text-sm">
            {navigation.map((item) => {
              const active = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "rounded-sm font-medium text-muted-foreground transition-colors hover:text-link focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring",
                      active && "font-semibold text-primary"
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="ml-4 flex items-center gap-2 md:ml-8">
          <AccountMenu />
          <Button asChild className="hidden h-[42px] px-4 sm:inline-flex">
            <Link href="/research">New research</Link>
          </Button>
        </div>
      </div>
      <nav className="border-t border-border bg-white md:hidden" aria-label="Mobile navigation">
        <ul className="mx-auto flex max-w-[1440px] items-stretch justify-around px-2 text-sm">
          {navigation.map((item) => {
            const active = pathname === item.href;
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center justify-center rounded-md px-3 font-medium text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring",
                    active && "font-semibold text-primary"
                  )}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
