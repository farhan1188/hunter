import Link from "next/link";

const NAV = [
  { href: "/feed", label: "Feed" },
  { href: "/profile", label: "Profile" },
  { href: "/settings", label: "Settings" },
  { href: "/inbox", label: "Inbox" },
  { href: "/history", label: "History" },
];

export function SiteNav() {
  return (
    <nav className="border-b bg-white">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
        <Link href="/" className="font-bold">
          Job Hunter
        </Link>
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="text-sm text-gray-700 hover:text-gray-900"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
