"use client";

import type { DecisionResult } from "@/lib/engine/decision";

import { money } from "@/lib/format";

function fmtAssumption(v: number, unit: string): string {
  if (unit === "rate") return `${(v * 100).toFixed(v * 100 < 10 ? 1 : 0)}%`;
  if (unit === "won") return money(v);
  if (unit === "months") return `${v}개월`;
  return `${v}년`;
}

/** 화면에서 조정할 수 있는 가정과 슬라이더 범위 — 서버 검증 범위와 같아야 한다 */
const SLIDER: Record<string, { min: number; max: number; step: number }> = {
  wageScarRate: { min: 0, max: 0.6, step: 0.01 },
  reemploymentDelayMonths: { min: 0, max: 60, step: 1 },
  wageGrowthRate: { min: 0, max: 0.15, step: 0.005 },
  careCostInflation: { min: 0, max: 0.15, step: 0.005 },
  pensionReplacementPerYear: { min: 0, max: 0.05, step: 0.0025 },
  localHealthInsuranceMonthly: { min: 0, max: 1_000_000, step: 10_000 },
};

export function DecisionPanel({
  decision,
  range,
  overrides = {},
  onOverride,
  onReset,
}: {
  decision: DecisionResult;
  /** 가정을 양 끝으로 몰았을 때의 손익 범위 */
  range?: { low: number; high: number; flips: boolean };
  overrides?: Record<string, number>;
  onOverride?: (key: string, value: number) => void;
  onReset?: () => void;
}) {
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
      {range && (
        <div
          className="card"
          style={{ marginTop: 14, padding: "13px 16px", background: "var(--surface-sunk)" }}
        >
          <p className="eyebrow" style={{ marginBottom: 7 }}>이 숫자를 얼마나 믿어야 하나</p>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.75, color: "var(--ink-2)" }}>
            가정을 양 끝으로 몰면 결과는{" "}
            <strong className="num">
              {range.low >= 0 ? "" : "−"}
              {money(Math.abs(range.low))} ~ {money(range.high)}
            </strong>{" "}
            사이에서 움직입니다.
            {range.flips ? (
              <>
                {" "}
                <strong style={{ color: "var(--warn)" }}>
                  이 범위 안에서 결론이 뒤집힙니다.
                </strong>{" "}
                임금 하락과 연금 영향을 0으로 놓으면 퇴사가 유리해집니다. 그 두 값이 본인에게
                해당하는지 확인이 필요합니다.
              </>
            ) : (
              <>
                {" "}
                <strong style={{ color: "var(--accent)" }}>
                  범위 전체에서 결론은 바뀌지 않습니다.
                </strong>{" "}
                가정을 어떻게 잡아도 같은 답이 나옵니다.
              </>
            )}
          </p>
        </div>
      )}

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
          {Object.keys(overrides).length > 0 && (
            <span className="chip" style={{ marginLeft: 8, color: "var(--warn)", borderColor: "var(--warn)" }}>
              {Object.keys(overrides).length}개 조정됨
            </span>
          )}
        </summary>
        {Object.keys(overrides).length > 0 && onReset && (
          <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "var(--ink-2)" }}>
            조정한 값으로 위 결과를 다시 계산했습니다.{" "}
            <button
              type="button"
              onClick={onReset}
              style={{
                border: "1px solid var(--line)",
                background: "var(--surface)",
                padding: "3px 9px",
                borderRadius: 2,
                cursor: "pointer",
                fontSize: 12.5,
              }}
            >
              기본값으로 되돌리기
            </button>
          </p>
        )}
        <div className="scroll-x" style={{ marginTop: 12 }}>
          <table className="data">
            <thead>
              <tr>
                <th>가정</th>
                <th className="right" style={{ width: 90 }}>값</th>
                <th style={{ width: 74 }}>확신도</th>
                {onOverride && <th style={{ width: 150 }}>바꿔 보기</th>}
                <th style={{ width: "36%" }}>근거</th>
              </tr>
            </thead>
            <tbody>
              {decision.assumptions.map((a) => (
                <tr key={a.key}>
                  <td>{a.label}</td>
                  <td className="right num">
                    {fmtAssumption(overrides[a.key] ?? a.value, a.unit)}
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
                  {onOverride && (
                    <td>
                      {SLIDER[a.key] && a.editable ? (
                        <input
                          type="range"
                          min={SLIDER[a.key].min}
                          max={SLIDER[a.key].max}
                          step={SLIDER[a.key].step}
                          // 서버 응답을 기다리는 동안에도 손잡이가 따라와야 한다.
                          // a.value 만 쓰면 재계산 전까지 값이 튕긴다.
                          value={overrides[a.key] ?? a.value}
                          aria-label={`${a.label} 조정`}
                          onChange={(e) => onOverride(a.key, Number(e.target.value))}
                          style={{ width: "100%" }}
                        />
                      ) : (
                        <span style={{ fontSize: 12, color: "var(--ink-3)" }}>고정</span>
                      )}
                    </td>
                  )}
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
