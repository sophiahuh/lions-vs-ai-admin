"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const GROUPS = [
  { title: "Overview", links: [{ href: "/", label: "Dashboard" }] },
  {
    title: "Content",
    links: [
      { href: "/media", label: "Posts" },
      { href: "/votes", label: "Ratings" },
      { href: "/images", label: "Image files" },
    ],
  },
  {
    title: "Caption writing",
    links: [
      { href: "/chains", label: "Flavors & weights" },
      { href: "/terms", label: "Columbia terms" },
      { href: "/examples", label: "Example captions" },
    ],
  },
  {
    title: "Models",
    links: [
      { href: "/models", label: "Models & prices" },
      { href: "/providers", label: "Providers" },
    ],
  },
  {
    title: "Logs",
    links: [
      { href: "/requests", label: "Caption requests" },
      { href: "/responses", label: "Model calls" },
    ],
  },
  {
    title: "Access",
    links: [
      { href: "/users", label: "Users" },
      { href: "/domains", label: "Allowed domains" },
      { href: "/emails", label: "Allowed emails" },
    ],
  },
];

export default function Nav() {
  const path = usePathname();
  return (
    <nav className="flex gap-4 overflow-x-auto md:flex-col md:gap-3">
      {GROUPS.map((g) => (
        <div key={g.title} className="shrink-0">
          <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">{g.title}</p>
          <div className="flex gap-1 md:flex-col">
            {g.links.map((l) => {
              const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    active ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
