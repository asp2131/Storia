import Link from "next/link";
import "../globals.css";

const tabs = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/soundscapes", label: "Soundscapes" },
  { href: "/admin/books/new", label: "Create Book" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white">
      <header className="border-b border-[#232948] bg-[#101322]/90 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-black font-serif tracking-tight">
            Storia Admin
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            {tabs.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                className="px-3 py-1.5 rounded-lg border border-transparent hover:border-[#373c5a] hover:bg-[#161b2e] transition"
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">{children}</main>
    </div>
  );
}
