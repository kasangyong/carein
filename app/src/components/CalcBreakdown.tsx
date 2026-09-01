"use client";

import type { CostResult } from "@/lib/engine/cost";

const won = (n: number) => Math.round(n).toLocaleString("ko-KR");

export function CalcBreakdown({ cost }: { cost: CostResult }) {
  return (
    <>
      <div className="card" style={{ padding: "14px 18px" }}>
        {cost.steps.map((s, i) => (
          <div key={i} className={`calcstep${s.kind === "total" ? " is-total" : ""}`}>
            <span style={{ color: s.kind === "total" ? "var(--ink)" : "var(--ink-2)" }}>
              {s.label}
            </span>
            <span
              className="num"
              style={{
                fontSize: s.kind === "total" ? 17 : 14,
                color:
                  s.kind === "deduction"
                    ? "var(--accent)"
                    : s.kind === "extra"
                      ? "var(--warn)"
                      : "var(--ink)",
                fontWeight: s.kind === "total" ? 600 : 400,
                whiteSpace: "nowrap",
              }}
            >
              {s.amount < 0 ? "−" : ""}
              {won(Math.abs(s.amount))}원
            </span>
            <span className="formula">
              {s.formula}
              {s.source && <span style={{ marginLeft: 8, opacity: 0.75 }}>· {s.source}</span>}
            </span>
          </div>
        ))}
      </div>

      {cost.warnings.length > 0 && (
        <ul
          style={{
            margin: "12px 0 0",
            paddingLeft: 18,
            fontSize: 13,
            color: "var(--warn)",
            lineHeight: 1.6,
          }}
        >
          {cost.warnings.map((w, i) => (
            <li key={i} style={{ marginBottom: 5 }}>
              {w}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
