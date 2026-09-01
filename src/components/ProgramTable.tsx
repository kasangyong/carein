"use client";

import { Fragment, useState } from "react";
import type { MatchSummary, MatchResult } from "@/lib/engine/match";

const won = (n: number) => n.toLocaleString("ko-KR");

export function ProgramTable({ summary }: { summary: MatchSummary }) {
  const [open, setOpen] = useState<string | null>(null);

  const rows = [
    ...summary.eligible.map((r) => ({ r, verdict: "eligible" as const })),
    ...summary.unknown.map((r) => ({ r, verdict: "unknown" as const })),
    ...summary.ineligible.map((r) => ({ r, verdict: "ineligible" as const })),
  ];

  return (
    <>
      {summary.overlooked.length > 0 && (
        <div
          className="card"
          style={{
            padding: "13px 15px",
            marginBottom: 14,
            background: "var(--accent-soft)",
            borderColor: "var(--accent)",
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--accent)" }}>
            인지도가 낮아 놓치기 쉬운 제도 {summary.overlooked.length}개가 걸렸습니다
          </div>
          <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 4 }}>
            {summary.overlooked.map((r) => r.program.name).join(" · ")}
          </div>
        </div>
      )}

      <div className="card scroll-x">
        <table className="data">
          <thead>
            <tr>
              <th style={{ width: 78 }}>판정</th>
              <th>제도</th>
              <th className="right" style={{ width: 110 }}>월 금액</th>
              <th style={{ width: 130 }}>소관</th>
              <th style={{ width: 44 }} />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ r, verdict }) => {
              const isOpen = open === r.program.id;
              return (
                <Fragment key={r.program.id}>
                  <tr>
                    <td>
                      <VerdictChip verdict={verdict} />
                    </td>
                    <td>
                      <div style={{ fontWeight: 550 }}>
                        {r.program.name}
                        {r.program.awareness === "low" && (
                          <span
                            className="badge badge-ai"
                            style={{ marginLeft: 7, verticalAlign: "middle" }}
                          >
                            놓치기 쉬움
                          </span>
                        )}
                        {r.program.verified === "needs-check" && (
                          <span
                            className="badge badge-check"
                            style={{ marginLeft: 7, verticalAlign: "middle" }}
                          >
                            출처 확인 필요
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12.5, color: "var(--ink-2)", marginTop: 2 }}>
                        {r.program.summary}
                      </div>
                    </td>
                    <td className="right num">
                      {r.program.monthlyAmount !== null ? (
                        <span style={{ fontWeight: r.countable ? 600 : 400, color: r.countable ? "var(--ink)" : "var(--ink-3)" }}>
                          {won(r.program.monthlyAmount)}원
                        </span>
                      ) : (
                        <span style={{ color: "var(--ink-3)" }}>—</span>
                      )}
                    </td>
                    <td style={{ fontSize: 12.5, color: "var(--ink-2)" }}>{r.program.authority}</td>
                    <td className="right">
                      <button
                        onClick={() => setOpen(isOpen ? null : r.program.id)}
                        aria-expanded={isOpen}
                        style={{
                          border: "1px solid var(--line-strong)",
                          background: "transparent",
                          borderRadius: 2,
                          width: 26,
                          height: 24,
                          cursor: "pointer",
                          color: "var(--ink-2)",
                        }}
                      >
                        {isOpen ? "−" : "+"}
                      </button>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={5} style={{ background: "var(--surface-sunk)" }}>
                        <Detail r={r} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          marginTop: 12,
          fontSize: 13,
        }}
      >
        <span style={{ color: "var(--ink-2)" }}>
          합산 가능한 월 지원액{" "}
          <strong className="num" style={{ fontSize: 15 }}>
            {won(summary.countableMonthlyTotal)}원
          </strong>
        </span>
        {summary.potentialMonthlyTotal > 0 && (
          <span style={{ color: "var(--ink-3)" }}>
            확인만 되면 추가 가능 {won(summary.potentialMonthlyTotal)}원 · 확인 전이라 합계에 넣지
            않았습니다
          </span>
        )}
      </div>
    </>
  );
}

function VerdictChip({ verdict }: { verdict: "eligible" | "unknown" | "ineligible" }) {
  const map = {
    eligible: { text: "해당", bg: "var(--accent-soft)", fg: "var(--accent)" },
    unknown: { text: "확인 필요", bg: "var(--warn-soft)", fg: "var(--warn)" },
    ineligible: { text: "미해당", bg: "var(--surface-sunk)", fg: "var(--ink-3)" },
  }[verdict];
  return (
    <span
      className="badge"
      style={{ background: map.bg, color: map.fg }}
    >
      {map.text}
    </span>
  );
}

function Detail({ r }: { r: MatchResult }) {
  return (
    <div style={{ padding: "4px 0 8px", display: "grid", gap: 12 }}>
      <div>
        <div className="eyebrow" style={{ marginBottom: 5 }}>판정 근거</div>
        <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", fontSize: 13 }}>
          {r.checks.map((c, i) => (
            <li key={i} style={{ display: "flex", gap: 8, padding: "3px 0" }}>
              <span
                className="num"
                style={{
                  width: 60,
                  flexShrink: 0,
                  color:
                    c.verdict === "eligible"
                      ? "var(--accent)"
                      : c.verdict === "ineligible"
                        ? "var(--warn)"
                        : "var(--ink-3)",
                }}
              >
                {c.verdict === "eligible" ? "충족" : c.verdict === "ineligible" ? "미충족" : "미확인"}
              </span>
              <span style={{ color: "var(--ink-2)" }}>{c.rule.describe}</span>
            </li>
          ))}
        </ul>
      </div>

      {r.blockedBy.length > 0 && (
        <Line label="선행 요건 미충족" value={r.blockedBy.join(", ")} />
      )}
      {r.conflictsWith.length > 0 && (
        <Line label="동시 수급 불가" value={r.conflictsWith.join(", ")} />
      )}

      <Line label="지원 내용" value={r.program.benefit} />
      <Line label="신청처" value={r.program.applyAt} />
      <Line label="근거 법령" value={r.program.legalBasis} />
      <Line label="확인 출처" value={r.program.source} />
      {r.program.caveat && (
        <Line label="유의" value={r.program.caveat} warn />
      )}
    </div>
  );
}

function Line({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 12, fontSize: 13, alignItems: "baseline" }}>
      <span className="eyebrow" style={{ width: 104, flexShrink: 0 }}>{label}</span>
      <span style={{ color: warn ? "var(--warn)" : "var(--ink-2)" }}>{value}</span>
    </div>
  );
}
