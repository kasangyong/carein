"use client";

import Link from "next/link";
import { SiteNav } from "./SiteNav";

/**
 * 모든 화면이 같은 헤더를 쓴다.
 * 페이지마다 헤더를 따로 만들면 높이와 정렬이 어긋나 탭을 옮길 때 화면이 흔들린다.
 */
export function SiteHeader() {
  return (
    <header style={{ borderBottom: "1px solid var(--line)", background: "var(--surface)" }}>
      <div
        className="shell"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
          height: 56,
        }}
      >
        <Link
          href="/"
          style={{ textDecoration: "none", color: "var(--ink)", display: "flex", alignItems: "baseline", gap: 9 }}
        >
          <strong style={{ fontSize: 17, letterSpacing: "-0.03em" }}>carein</strong>
          <span style={{ fontSize: 12.5, color: "var(--ink-3)" }} className="tagline">
            돌봄 재무 내비게이터
          </span>
        </Link>
        <SiteNav />
      </div>
    </header>
  );
}
