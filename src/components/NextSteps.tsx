"use client";

import { useState } from "react";
import type { MatchSummary } from "@/lib/engine/match";
import { getProgram } from "@/lib/kb/programs";

/**
 * 신청 순서 + AI 설명.
 *
 * 순서는 규칙(선행 요건 위상정렬)이 만든다.
 * AI는 그 순서를 사람 말로 옮기기만 한다. 순서를 바꾸지 않는다.
 */
export function NextSteps({
  summary,
  facts,
}: {
  summary: MatchSummary;
  facts: Record<string, unknown>;
}) {
  const [text, setText] = useState<string | null>(null);
  const [guardrails, setGuardrails] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const actionable = summary.applicationOrder
    .map((id) => getProgram(id))
    .filter((p): p is NonNullable<typeof p> => !!p);

  async function generate() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: "next-steps",
          facts,
          programIds: actionable.map((p) => p.id),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "설명을 생성하지 못했습니다.");
      setText(json.text);
      setGuardrails(json.guardrails ?? null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "설명을 생성하지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <ol className="card" style={{ margin: 0, padding: "6px 18px 6px 40px" }}>
        {actionable.map((p) => (
          <li key={p.id} style={{ padding: "11px 0", borderBottom: "1px solid var(--line)" }}>
            <div style={{ fontWeight: 550 }}>{p.name}</div>
            <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 2 }}>{p.applyAt}</div>
            {p.requires && p.requires.length > 0 && (
              <div className="num" style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 3 }}>
                먼저 필요: {p.requires.map((r) => getProgram(r)?.name ?? r).join(", ")}
              </div>
            )}
          </li>
        ))}
      </ol>

      <div style={{ marginTop: 14 }}>
        {!text && (
          <button
            onClick={generate}
            disabled={loading || actionable.length === 0}
            style={{
              border: "1px solid var(--primary)",
              background: loading ? "var(--surface-sunk)" : "var(--primary)",
              color: loading ? "var(--ink-3)" : "#fff",
              padding: "9px 16px",
              borderRadius: 2,
              cursor: loading ? "wait" : "pointer",
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            {loading ? "설명 생성 중…" : "AI 설명 받기"}
          </button>
        )}
        {err && (
          <p style={{ fontSize: 13, color: "var(--warn)", marginTop: 10 }}>
            {err}
            <br />
            <span style={{ color: "var(--ink-3)" }}>
              위 순서와 신청처는 규칙이 만든 것이라 설명 없이도 그대로 유효합니다.
            </span>
          </p>
        )}

        {text && (
          <div className="card" style={{ padding: "14px 16px", background: "var(--accent-soft)" }}>
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                marginBottom: 8,
                flexWrap: "wrap",
              }}
            >
              <span className="badge badge-ai">AI 생성 문장</span>
              {guardrails ? <GuardrailChips g={guardrails} /> : null}
            </div>
            <p style={{ margin: 0, fontSize: 14, whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
              {text}
            </p>
          </div>
        )}
      </div>
    </>
  );
}

function GuardrailChips({ g }: { g: Record<string, unknown> }) {
  const citations = Number(g.citationCount ?? 0);
  const ungrounded = (g.ungroundedFindings as string[]) ?? [];
  const injections = (g.injectionsBlocked as string[]) ?? [];

  return (
    <>
      <span className="chip">근거 {citations}건 인용</span>
      {injections.length > 0 && (
        <span className="chip" style={{ color: "var(--warn)", borderColor: "var(--warn)" }}>
          인젝션 {injections.length}건 차단
        </span>
      )}
      <span
        className="chip"
        style={
          ungrounded.length > 0
            ? { color: "var(--warn)", borderColor: "var(--warn)" }
            : { color: "var(--accent)", borderColor: "var(--accent)" }
        }
      >
        {ungrounded.length > 0 ? `근거 없는 금액 ${ungrounded.length}건 발견` : "근거 검증 통과"}
      </span>
    </>
  );
}
