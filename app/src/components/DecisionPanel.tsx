"use client";

import type { DecisionResult } from "@/lib/engine/decision";

import { money } from "@/lib/format";

export function DecisionPanel({ decision }: { decision: DecisionResult }) {
  const naive = decision.naiveRecommendation === "quit" ? "퇴사" : "유지";
  const actual =
    decision.recommendation === "quit"
      ? "퇴사"
      : decision.recommendation === "keep"
        ? "유지"
        : "차이 작음";

  return (
    <>
      {/* 반전 — 이 서비스가 존재하는 이유 */}
      <div
        className="card"
        style={{
          padding: 0,
          overflow: "hidden",
          borderColor: decision.isReversal ? "var(--warn)" : "var(--line)",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 1,
            background: "var(--line)",
          }}
        >
          <Side
            caption="월 단위로만 보면"
            verdict={naive}
            detail={`월 ${money(Math.abs(decision.naiveMonthlyDelta))} ${decision.naiveMonthlyDelta > 0 ? "유지가 이득" : "퇴사가 이득"}`}
            muted
          />
          <Side
            caption="10년으로 계산하면"
            verdict={actual}
            detail={
              decision.recommendation === "close"
                ? "두 선택의 차이가 크지 않습니다"
                : `10년 누적 ${money(Math.abs(decision.totalDelta))} 차이`
            }
            emphasis={decision.isReversal}
          />
        </div>

        {decision.isReversal && (
          <div
            style={{
              padding: "11px 16px",
              background: "var(--warn-soft)",
              borderTop: "1px solid var(--warn)",
              fontSize: 13.5,
              color: "var(--warn)",
              fontWeight: 550,
            }}
          >
            직관과 결과가 반대입니다. 아래 항목들이 월 단위 계산에서 빠져 있었습니다.
          </div>
        )}
      </div>

      {/* 무엇이 손익을 갈랐나 */}
      <div className="card scroll-x" style={{ marginTop: 14 }}>
        <table className="data">
          <thead>
            <tr>
              <th>항목</th>
              <th className="right" style={{ width: 116 }}>유지 유리</th>
              <th style={{ width: "42%" }}>설명</th>
            </tr>
          </thead>
          <tbody>
            {decision.breakdown.map((b) => (
              <tr key={b.label}>
                <td style={{ fontWeight: 500 }}>{b.label}</td>
                <td
                  className="right num"
                  style={{ color: b.amount >= 0 ? "var(--ink)" : "var(--warn)", whiteSpace: "nowrap" }}
                >
                  {b.amount >= 0 ? "+" : "−"}
                  {money(Math.abs(b.amount))}
                </td>
                <td style={{ fontSize: 12.5, color: "var(--ink-2)" }}>{b.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {decision.irreversibleWarnings.length > 0 && (
        <div
          className="card"
          style={{ marginTop: 14, padding: "13px 16px", background: "var(--surface-sunk)" }}
        >
          <p className="eyebrow" style={{ marginBottom: 7 }}>되돌리기 어려운 결정</p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: "var(--ink-2)" }}>
            {decision.irreversibleWarnings.map((w, i) => (
              <li key={i} style={{ marginBottom: 4 }}>
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 가정 공개 — 숨기지 않는다 */}
      <details className="card" style={{ marginTop: 14, padding: "12px 16px" }}>
        <summary style={{ cursor: "pointer", fontSize: 13.5, fontWeight: 550 }}>
          이 계산에 쓴 가정 {decision.assumptions.length}개 보기
        </summary>
        <div className="scroll-x" style={{ marginTop: 12 }}>
          <table className="data">
            <thead>
              <tr>
                <th>가정</th>
                <th className="right" style={{ width: 90 }}>값</th>
                <th style={{ width: 74 }}>확신도</th>
                <th style={{ width: "46%" }}>근거</th>
              </tr>
            </thead>
            <tbody>
              {decision.assumptions.map((a) => (
                <tr key={a.key}>
                  <td>{a.label}</td>
                  <td className="right num">
                    {a.unit === "rate"
                      ? `${(a.value * 100).toFixed(0)}%`
                      : a.unit === "won"
                        ? money(a.value)
                        : a.unit === "months"
                          ? `${a.value}개월`
                          : `${a.value}년`}
                  </td>
                  <td>
                    <span
                      className="badge"
                      style={{
                        background:
                          a.confidence === "high"
                            ? "var(--accent-soft)"
                            : a.confidence === "low"
                              ? "var(--warn-soft)"
                              : "var(--surface-sunk)",
                        color:
                          a.confidence === "high"
                            ? "var(--accent)"
                            : a.confidence === "low"
                              ? "var(--warn)"
                              : "var(--ink-2)",
                      }}
                    >
                      {a.confidence === "high" ? "높음" : a.confidence === "low" ? "낮음" : "보통"}
                    </span>
                  </td>
                  <td style={{ fontSize: 12.5, color: "var(--ink-2)" }}>{a.basis}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}

function Side({
  caption,
  verdict,
  detail,
  muted,
  emphasis,
}: {
  caption: string;
  verdict: string;
  detail: string;
  muted?: boolean;
  emphasis?: boolean;
}) {
  return (
    <div
      style={{
        background: "var(--surface)",
        padding: "16px 18px",
      }}
    >
      <div className="eyebrow" style={{ marginBottom: 8 }}>{caption}</div>
      <div
        style={{
          fontSize: 26,
          fontWeight: 600,
          letterSpacing: "-0.03em",
          color: muted ? "var(--ink-3)" : emphasis ? "var(--warn)" : "var(--ink)",
        }}
      >
        {verdict}
      </div>
      <div className="num" style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 4 }}>
        {detail}
      </div>
    </div>
  );
}
