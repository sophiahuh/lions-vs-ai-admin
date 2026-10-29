"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const GROUPS = [
  { title: "Overview", links: [{ href: "/", label: "Dashboard" }] },
  {
    title: "People",
    links: [
      { href: "/users", label: "Users" },
      { href: "/domains", label: "Signup domains" },
      { href: "/emails", label: "Whitelisted emails" },
    ],
  },
  {
    title: "Content",
    links: [
      { href: "/media", label: "AI media" },
      { href: "/images", label: "Images" },
      { href: "/votes", label: "Votes" },
    ],
  },
  {
    title: "Pipeline",
    links: [
      { href: "/chains", label: "Prompt chains" },
      { href: "/mix", label: "Chain mix" },
      { href: "/terms", label: "Terms" },
      { href: "/examples", label: "Examples" },
      { href: "/models", label: "LLM models" },
      { href: "/providers", label: "LLM providers" },
    ],
  },
  {
    title: "Observability",
    links: [
      { href: "/requests", label: "Generation requests" },
      { href: "/responses", label: "LLM responses" },
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
