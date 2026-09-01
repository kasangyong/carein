"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "계산하기" },
  { href: "/insights", label: "비용 지형" },
  { href: "/governance", label: "AI 통제" },
  { href: "/partners", label: "채널 연계" },
  { href: "/developers", label: "오픈 API" },
];

export function SiteNav() {
  const path = usePathname();
  return (
    <nav style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
      {LINKS.map((l) => {
        const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            style={{
              fontSize: 12.5,
              textDecoration: "none",
              whiteSpace: "nowrap",
              color: active ? "var(--ink)" : "var(--ink-3)",
              fontWeight: active ? 600 : 400,
              borderBottom: active ? "1px solid var(--primary)" : "1px solid transparent",
              paddingBottom: 2,
            }}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
