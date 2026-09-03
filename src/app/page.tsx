"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { PRESETS } from "@/lib/presets";
import type { AnalyzeResult } from "@/lib/engine/analyze";
import { Gauge } from "@/components/Gauge";
import { ProgramTable } from "@/components/ProgramTable";
import { CalcBreakdown } from "@/components/CalcBreakdown";
import { DecisionPanel } from "@/components/DecisionPanel";
import { NextSteps } from "@/components/NextSteps";
import { CaseForm } from "@/components/CaseForm";
import { FamilyPanel } from "@/components/FamilyPanel";
import { readCaseFromHash } from "@/lib/share";
import type { AnalyzeInput } from "@/lib/engine/analyze";

import { money } from "@/lib/format";

/**
 * 막대가 안 움직이는 이유는 사례마다 다르다. 뭉뚱그리면 서비스가 고장 난 것처럼 읽힌다.
 * 실제로 늘어날 것이 없는 경우도 있고, 그게 정답인 경우도 있다.
 */
function flatReason(r: AnalyzeResult): string {
  const withAmount = [...r.programs.eligible, ...r.programs.unknown].filter(
    (m) => m.monthlyAmount !== null,
  );
  if (withAmount.length === 0 && r.valuedSupport.length === 0) {
    return r.programs.eligible.length > 0
      ? "해당하는 제도가 서비스·휴가 형태라 버티는 기간은 늘지 않습니다. 돈이 아니라 시간을 벌어주는 제도입니다"
      : "소득·재산 기준을 넘어 해당하는 지원 제도가 없습니다";
  }
  return "이미 받고 계신 제도가 반영돼 있어 추가로 늘어나는 기간은 없습니다";
}

const CONFIDENCE_KO = { high: "높음", medium: "보통", low: "낮음" } as const;

/**
 * 늘어난 기간이 어디서 나왔는지 한 줄로 밝힌다.
 * 이 줄이 없으면 옆의 "놓치고 있던 제도 N개 · 연 36만원" 이 원인처럼 읽힌다.
 * 연 36만원으로 93개월이 늘어날 수는 없다.
 */
function gainSource(r: AnalyzeResult): string | undefined {
  const { monthsGainedByPilot: pilot, monthsGainedBySupport: sup, gainDriver } = r.headline;
  const m = (n: number) =>
    Math.floor(n / 12) > 0 ? `${Math.floor(n / 12)}년 ${n % 12}개월` : `${n}개월`;
  if (gainDriver === "pilot")
    return `대부분(${m(pilot)})은 간병비 급여화 대상 확인에서 나옵니다`;
  if (gainDriver === "support") return `제도 신청에서 ${m(sup)}`;
  if (gainDriver === "both")
    return `급여화 확인 ${m(pilot)} + 제도 신청 ${m(sup)}`;
  return undefined;
}

export default function Home() {
  const [presetId, setPresetId] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"preset" | "custom">("preset");
  const [horizonYears, setHorizonYears] = useState(10);
  const [usedInput, setUsedInput] = useState<AnalyzeInput | null>(null);
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  /**
   * 가정 재계산은 이 ref 를 기준으로 한다.
   * usedInput 상태를 effect 의존성에 넣으면 post 가 그 값을 다시 세팅해 무한 루프가 된다.
   */
  const inputRef = useRef<AnalyzeInput | null>(null);

  const post = useCallback(async (body: Record<string, unknown>, scroll = true) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "분석에 실패했습니다.");
      setResult(json.result as AnalyzeResult);
      setUsedInput((json.input as AnalyzeInput) ?? null);
      inputRef.current = (json.input as AnalyzeInput) ?? null;
      setHorizonYears((json.input as AnalyzeInput)?.horizonYears ?? 10);
      if (scroll) {
        requestAnimationFrame(() =>
          document.getElementById("result")?.scrollIntoView({ behavior: "smooth", block: "start" }),
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "분석에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 가정값을 바꾸면 다시 계산한다. 슬라이더는 자주 움직이므로 멈춘 뒤 한 번만 보낸다.
   * 화면이 튀지 않게 스크롤은 하지 않는다.
   */
  useEffect(() => {
    if (Object.keys(overrides).length === 0) return;
    const base = inputRef.current;
    if (!base) return;
    const t = setTimeout(() => {
      void post({ input: { ...base, assumptionOverrides: overrides } }, false);
    }, 320);
    return () => clearTimeout(t);
  }, [overrides, post]);

  // 공유 링크로 들어온 경우 — 서버 저장 없이 링크에 담긴 사례를 복원한다.
  // 상태 변경은 fetch 이후에 한다. 렌더 중 동기 setState 는 하이드레이션을 깨뜨린다.
  useEffect(() => {
    const shared = readCaseFromHash();
    if (!shared) return;
    void (async () => {
      await post({ input: shared });
      setMode("custom");
    })();
  }, [post]);

  function run(id: string) {
    setPresetId(id);
    setOverrides({});
    void post({ presetId: id });
  }

  function runCustom(input: AnalyzeInput) {
    setPresetId(null);
    setOverrides({});
    void post({ input });
  }

  return (
    <>
      <SiteHeader />

      {/* ── 도입 ── */}
      <section className="shell" style={{ paddingTop: 56, paddingBottom: 40 }}>
        <p className="eyebrow-latin" style={{ marginBottom: 14 }}>2026 FINANCE AI CHALLENGE</p>
        <h1 style={{ fontSize: "clamp(26px, 4.4vw, 41px)", maxWidth: "18ch", fontWeight: 600 }}>
          돌봄이 시작되면
          <br />
          돈은 나가고 소득은 줄어듭니다.
        </h1>
        <p
          style={{
            marginTop: 18,
            maxWidth: "56ch",
            fontSize: 16,
            color: "var(--ink-2)",
          }}
        >
          그런데 이 사람의 재무를 계산해주는 곳은 없습니다. 장기요양 제도는 부모를 위한 것이고,
          은행은 자산이 늘어나는 고객을 봅니다. 돌보는 사람은 혼자 감으로 결정합니다.
        </p>

        <div style={{ marginTop: 34 }}>
          <div
            role="tablist"
            style={{ display: "flex", gap: 0, marginBottom: 16, borderBottom: "1px solid var(--line)" }}
          >
            {([
              ["preset", "사례로 보기"],
              ["custom", "직접 입력하기"],
            ] as const).map(([m, label]) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                style={{
                  border: 0,
                  background: "transparent",
                  padding: "8px 2px",
                  marginRight: 22,
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: mode === m ? 600 : 400,
                  color: mode === m ? "var(--ink)" : "var(--ink-3)",
                  borderBottom: mode === m ? "2px solid var(--primary)" : "2px solid transparent",
                  marginBottom: -1,
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === "custom" && <CaseForm onSubmit={runCustom} busy={loading} />}

          {mode === "preset" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(232px, 1fr))",
              gap: 12,
            }}
          >
            {PRESETS.map((p) => {
              const active = presetId === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => run(p.id)}
                  disabled={loading}
                  className="card"
                  style={{
                    textAlign: "left",
                    padding: "14px 15px",
                    cursor: loading ? "wait" : "pointer",
                    borderColor: active ? "var(--primary)" : "var(--line)",
                    boxShadow: active ? "inset 0 0 0 1px var(--primary)" : "none",
                    transition: "border-color 140ms, box-shadow 140ms",
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 14.5, marginBottom: 4 }}>{p.title}</div>
                  <div style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.5 }}>
                    {p.subtitle}
                  </div>
                  <div
                    className="eyebrow"
                    style={{ marginTop: 10, color: "var(--ink-3)", textTransform: "none", letterSpacing: 0 }}
                  >
                    {p.demonstrates}
                  </div>
                </button>
              );
            })}
          </div>
          )}
          {loading && (
            <p className="num" style={{ marginTop: 16, fontSize: 13, color: "var(--ink-3)" }}>
              제도 대조 → 비용 산출 → 10년 시뮬레이션 계산 중…
            </p>
          )}
          {error && (
            <p style={{ marginTop: 16, fontSize: 13.5, color: "var(--warn)" }}>{error}</p>
          )}
        </div>
      </section>

      {result && (
        <main id="result" style={{ paddingBottom: 96 }}>
          {/* ── 시그니처: 버티는 기간 ── */}
          <section
            style={{
              background: "var(--surface)",
              borderTop: "1px solid var(--line)",
              borderBottom: "1px solid var(--line)",
              padding: "34px 0",
            }}
          >
            <div className="shell">
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 10,
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  marginBottom: 20,
                }}
              >
                <h2 style={{ fontSize: 19 }}>부모님 자산으로 버틸 수 있는 기간</h2>
                <span className="badge badge-rule">규칙 계산 · AI 미개입</span>
              </div>

              <Gauge
                horizonMonths={horizonYears * 12}
                before={result.simulationWithoutPrograms.recipientDepletionMonth}
                after={result.simulation.recipientDepletionMonth}
                beforeLabel={result.headline.survivalWithoutPrograms}
                afterLabel={result.headline.survival}
                flatReason={flatReason(result)}
                gainSource={gainSource(result)}
              />

              <div
                style={{
                  marginTop: 26,
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                  gap: 1,
                  background: "var(--line)",
                  border: "1px solid var(--line)",
                }}
              >
                <Stat
                  label="놓치고 있던 제도"
                  value={`${result.headline.overlookedCount}개`}
                  sub={`연 ${money(result.headline.annualSupport)}`}
                />
                <Stat
                  label="월 실부담"
                  value={money(result.headline.monthlyBurden)}
                  sub={`지금 그대로면 ${money(result.headline.monthlyBurdenBefore)}`}
                />
                <Stat
                  label="10년 총 돌봄비"
                  value={money(result.simulation.totalCareCost)}
                  sub={`제도 지원 ${money(result.simulation.totalProgramSupport)} 차감 전`}
                />
                <Stat
                  label="퇴사 여부"
                  value={
                    result.decision.recommendation === "keep"
                      ? "유지가 유리"
                      : result.decision.recommendation === "quit"
                        ? "퇴사가 유리"
                        : "차이 작음"
                  }
                  sub={result.headline.decisionReversal ? "직관과 반대입니다" : "직관과 같습니다"}
                  emphasis={result.headline.decisionReversal}
                />
              </div>

              {result.valuedSupport.length > 0 && (
                <div style={{ marginTop: 18 }}>
                  <div className="eyebrow" style={{ marginBottom: 8 }}>
                    현금이 아니지만 돈이 되는 제도
                  </div>
                  <div className="card scroll-x">
                    <table className="data">
                      <thead>
                        <tr>
                          <th>제도</th>
                          <th className="right" style={{ width: 110 }}>
                            월 환산액
                          </th>
                          <th>계산 근거</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.valuedSupport.map((v) => (
                          <tr key={v.programId}>
                            <td style={{ width: "30%" }}>
                              <strong>{v.name}</strong>{" "}
                              <span className="chip" style={{ marginLeft: 6 }}>
                                확신도 {CONFIDENCE_KO[v.confidence]}
                              </span>
                            </td>
                            <td className="num right">{money(v.monthly)}</td>
                            <td style={{ fontSize: 12.5, color: "var(--ink-2)" }}>{v.basis}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </section>

          <div className="shell" style={{ display: "grid", gap: 40, paddingTop: 40 }}>
            <Section
              title="찾은 제도"
              note="장기요양·고용·보건 제도를 프로파일과 대조했습니다. 값을 모르는 항목은 해당한다고 말하지 않습니다."
              badge={<span className="badge badge-rule">규칙 대조</span>}
            >
              <ProgramTable summary={result.programs} />
            </Section>

            <Section
              title="비용이 이렇게 나옵니다"
              note="모든 숫자에 계산식이 붙어 있습니다. LLM은 이 값을 만들지 않습니다."
              badge={<span className="badge badge-rule">규칙 계산</span>}
            >
              <CalcBreakdown cost={result.cost} />
            </Section>

            <Section
              title="퇴사할까, 다닐까"
              note="월 단위 직관과 다년 계산이 자주 어긋납니다. 계산에 쓴 가정은 값·확신도·근거까지 전부 공개했고, 아래에서 직접 바꿔 보실 수 있습니다."
              badge={<span className="badge badge-rule">규칙 계산</span>}
            >
              <DecisionPanel
                decision={result.decision}
                range={result.decisionRange}
                overrides={overrides}
                onOverride={(key, value) => setOverrides((o) => ({ ...o, [key]: value }))}
                onReset={() => {
                  setOverrides({});
                  const base = inputRef.current;
                  if (base) void post({ input: { ...base, assumptionOverrides: undefined } }, false);
                }}
              />
            </Section>

            <Section
              title="지금 할 일"
              note="선행 요건을 따져 순서를 매겼습니다. 앞 단계를 건너뛰면 뒤 단계가 반려됩니다."
              badge={<span className="badge badge-ai">AI 설명</span>}
            >
              <NextSteps summary={result.programs} facts={result.headline} />
            </Section>

            <Section
              title="형제와 어떻게 나눌까"
              note="돌봄 갈등은 대개 한쪽은 돈으로 세고 다른 쪽은 시간으로 세기 때문에 생깁니다. 같은 단위로 놓으면 대화가 됩니다."
              badge={<span className="badge badge-rule">규칙 계산</span>}
            >
              <FamilyPanel monthlyBurden={result.headline.monthlyBurden} input={usedInput} />
            </Section>

            <Section
              title="무엇이 결과를 가장 크게 바꾸나"
              badge={<span className="badge badge-rule">민감도 분석</span>}
            >
              <div className="card" style={{ padding: 4 }}>
                <table className="data">
                  <thead>
                    <tr>
                      <th>변수</th>
                      <th className="right">변화</th>
                      <th className="right">버티는 기간</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.sensitivity.map((s) => (
                      <tr key={s.label}>
                        <td>{s.label}</td>
                        <td className="right num" style={{ color: "var(--ink-2)" }}>
                          {Math.abs(s.change) < 1
                            ? `${s.change > 0 ? "+" : ""}${(s.change * 100).toFixed(0)}%p`
                            : `${s.change > 0 ? "+" : ""}${money(s.change)}`}
                        </td>
                        <td
                          className="right num"
                          style={{
                            color: s.monthsGained > 0 ? "var(--accent)" : "var(--ink-3)",
                            fontWeight: s.monthsGained > 0 ? 600 : 400,
                          }}
                        >
                          {s.monthsGained > 0 ? `+${s.monthsGained}개월` : "변화 없음"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            {result.simulation.notes.length > 0 && (
              <div
                className="card"
                style={{ padding: "14px 16px", background: "var(--surface-sunk)" }}
              >
                <p className="eyebrow" style={{ marginBottom: 8 }}>시뮬레이션 가정</p>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: "var(--ink-2)" }}>
                  {result.simulation.notes.map((n, i) => (
                    <li key={i} style={{ marginBottom: 4 }}>
                      {n}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <footer
              style={{
                borderTop: "1px solid var(--line)",
                paddingTop: 20,
                fontSize: 12.5,
                color: "var(--ink-3)",
                lineHeight: 1.7,
              }}
            >
              <p style={{ margin: 0 }}>
                이 계산은 지급을 확정하지 않습니다. 제도 자격은 최종적으로 국민건강보험공단·보건소·
                고용노동부가 판단합니다. 여기서는 확인해 볼 가치가 있는 항목을 골라내고, 판단에 필요한
                숫자를 보여줍니다.
              </p>
              <p style={{ margin: "10px 0 0" }}>
                건강·소득 정보는 저장하지 않습니다. 화면을 닫으면 사라집니다.
              </p>
            </footer>
          </div>
        </main>
      )}
    </>
  );
}

function Stat({
  label,
  value,
  sub,
  emphasis,
}: {
  label: string;
  value: string;
  sub?: string;
  emphasis?: boolean;
}) {
  return (
    <div style={{ background: "var(--surface)", padding: "14px 16px" }}>
      <div className="eyebrow" style={{ marginBottom: 6 }}>{label}</div>
      <div
        className="num"
        style={{
          fontSize: 22,
          fontWeight: 600,
          color: emphasis ? "var(--warn)" : "var(--ink)",
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 3 }}>{sub}</div>
      )}
    </div>
  );
}

function Section({
  title,
  note,
  badge,
  children,
}: {
  title: string;
  note?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "baseline",
          justifyContent: "space-between",
          flexWrap: "wrap",
          marginBottom: 6,
        }}
      >
        <h2 style={{ fontSize: 18 }}>{title}</h2>
        {badge}
      </div>
      {note && (
        <p style={{ margin: "0 0 14px", fontSize: 13.5, color: "var(--ink-2)", maxWidth: "70ch" }}>
          {note}
        </p>
      )}
      {children}
    </section>
  );
}
