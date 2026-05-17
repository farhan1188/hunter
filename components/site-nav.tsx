"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/feed", label: "Feed" },
  { href: "/profile", label: "Profile" },
  { href: "/settings", label: "Settings" },
];

export function SiteNav() {
  const pathname = usePathname();
  return (
    <nav className="border-b bg-white">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
        <Link href="/dashboard" className="font-bold tracking-tight">
          Job Hunter
        </Link>
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                "text-sm transition-colors " +
                (active
                  ? "text-gray-900 font-medium"
                  : "text-gray-500 hover:text-gray-900")
              }
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
