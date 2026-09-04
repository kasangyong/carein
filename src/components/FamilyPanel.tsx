"use client";

import { useMemo, useState } from "react";
import type { AnalyzeInput } from "@/lib/engine/analyze";
import {
  evaluateFairness,
  buildShareUrl,
  CARE_HOUR_RATE,
  type Contributor,
} from "@/lib/share";
import { money } from "@/lib/format";

/**
 * 가족 분담.
 *
 * 돌봄 갈등은 대개 "누가 더 했나"를 서로 다른 단위로 세기 때문에 생긴다.
 * 한쪽은 돈으로 세고 다른 쪽은 시간으로 센다. 같은 단위로 놓으면 대화가 된다.
 */
export function FamilyPanel({
  monthlyBurden,
  input,
}: {
  monthlyBurden: number;
  input: AnalyzeInput | null;
}) {
  const siblings = input?.finances.siblingCount ?? 1;

  const [people, setPeople] = useState<Contributor[]>(() => {
    const n = Math.max(1, siblings + 1);
    return Array.from({ length: n }, (_, i) => ({
      id: `p${i}`,
      name: i === 0 ? "나" : `형제 ${i}`,
      money: Math.round(monthlyBurden / n),
      hours: i === 0 ? 40 : 8,
    }));
  });

  const [copied, setCopied] = useState(false);
  const fairness = useMemo(() => evaluateFairness(people), [people]);
  const [confirming, setConfirming] = useState(false);
  const [manualUrl, setManualUrl] = useState<string | null>(null);

  function update(id: string, patch: Partial<Contributor>) {
    setPeople((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  /**
   * 링크에 무엇이 담기는지 먼저 밝힌다.
   *
   * 프래그먼트라 서버에 안 남는 건 맞지만, 그게 "안전하다"는 뜻은 아니다.
   * base64 는 암호화가 아니라 인코딩이고, 링크를 받은 사람은 치매 진단 여부·
   * 소득·자산을 그대로 볼 수 있다. 단체 대화방에 붙이면 그 방 전체가 본다.
   * 그래서 복사 전에 무엇이 들어가는지 보여주고 한 번 더 확인받는다.
   */
  const sharedFields = useMemo(() => {
    if (!input) return [];
    const p = input.profile;
    const out: string[] = [];
    if (p.recipientAge !== undefined) out.push(`부모님 나이 ${p.recipientAge}세`);
    if (p.ltcGrade) out.push(`장기요양 ${p.ltcGrade}등급`);
    if (p.hasDementiaDiagnosis) out.push("치매 진단 여부");
    if (p.region) out.push(`지역 ${p.region}`);
    if (p.incomePercentile !== undefined) out.push("소득 구간");
    out.push("부모님 자산·소득", "본인 자산·소득·근속연수·나이");
    return out;
  }, [input]);

  async function copyLink() {
    if (!input) return;
    const url = buildShareUrl(input);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      // 클립보드가 막힌 환경(iframe·웹뷰)에서는 직접 선택하게 한다.
      // prompt() 는 여러 브라우저에서 차단돼 아무 일도 안 일어난다.
      setManualUrl(url);
    }
  }

  return (
    <>
      <div className="card scroll-x">
        <table className="data">
          <thead>
            <tr>
              <th>가족</th>
              <th className="right" style={{ width: 128 }}>월 부담액</th>
              <th className="right" style={{ width: 118 }}>월 돌봄 시간</th>
              <th className="right" style={{ width: 128 }}>시간 환산</th>
              <th className="right" style={{ width: 118 }}>합계</th>
              <th className="right" style={{ width: 96 }}>비중</th>
            </tr>
          </thead>
          <tbody>
            {fairness.rows.map((r) => (
              <tr key={r.contributor.id}>
                <td>
                  <input
                    value={r.contributor.name}
                    onChange={(e) => update(r.contributor.id, { name: e.target.value })}
                    style={{ ...cell, width: 92 }}
                  />
                </td>
                <td className="right">
                  <input
                    type="number"
                    className="num"
                    value={Math.round(r.contributor.money / 10_000)}
                    step={5}
                    min={0}
                    onChange={(e) =>
                      update(r.contributor.id, { money: Number(e.target.value) * 10_000 })
                    }
                    style={{ ...cell, width: 74, textAlign: "right" }}
                  />
                  <span style={{ fontSize: 11.5, color: "var(--ink-3)", marginLeft: 4 }}>만원</span>
                </td>
                <td className="right">
                  <input
                    type="number"
                    className="num"
                    value={r.contributor.hours}
                    step={4}
                    min={0}
                    onChange={(e) => update(r.contributor.id, { hours: Number(e.target.value) })}
                    style={{ ...cell, width: 60, textAlign: "right" }}
                  />
                  <span style={{ fontSize: 11.5, color: "var(--ink-3)", marginLeft: 4 }}>시간</span>
                </td>
                <td className="right num" style={{ color: "var(--ink-2)" }}>
                  {money(r.hoursValued)}
                </td>
                <td className="right num" style={{ fontWeight: 600 }}>
                  {money(r.total)}
                </td>
                <td className="right num">
                  <span
                    style={{
                      color:
                        Math.abs(r.vsEqual) < fairness.grandTotal * 0.05
                          ? "var(--ink-2)"
                          : r.vsEqual > 0
                            ? "var(--warn)"
                            : "var(--accent)",
                    }}
                  >
                    {r.sharePct.toFixed(0)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div
        className="card"
        style={{ marginTop: 12, padding: "13px 16px", background: "var(--surface-sunk)" }}
      >
        <p style={{ margin: 0, fontSize: 13.5 }}>
          돌봄 시간은 방문요양 시장가{" "}
          <strong className="num">{money(CARE_HOUR_RATE)}/시간</strong>으로 환산했습니다. 그 일을
          외부에 맡기면 실제로 드는 돈입니다.
        </p>
        {fairness.spread > 0 && (
          <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "var(--ink-2)" }}>
            가장 많이 부담하는 사람과 가장 적게 부담하는 사람의 차이는 월{" "}
            <strong className="num">{money(fairness.spread)}</strong>입니다.
          </p>
        )}
      </div>

      {input && (
        <div style={{ marginTop: 14 }}>
          {!confirming && !manualUrl && (
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <button
                onClick={() => setConfirming(true)}
                style={btn}
              >
                {copied ? "링크를 복사했습니다" : "가족에게 공유할 링크 만들기"}
              </button>
              <span style={{ fontSize: 12.5, color: "var(--ink-3)" }}>
                건강·소득 정보가 링크에 담깁니다. 무엇이 담기는지 먼저 보여드립니다.
              </span>
            </div>
          )}

          {confirming && !manualUrl && (
            <div
              className="card"
              style={{ padding: "14px 16px", borderLeft: "3px solid var(--warn)" }}
            >
              <p className="eyebrow" style={{ margin: "0 0 8px" }}>
                이 링크에 담기는 정보
              </p>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: 18,
                  fontSize: 13,
                  lineHeight: 1.8,
                  color: "var(--ink-2)",
                }}
              >
                {sharedFields.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <p
                style={{
                  margin: "11px 0 0",
                  fontSize: 12.5,
                  color: "var(--warn)",
                  lineHeight: 1.7,
                }}
              >
                주소 뒤(<span className="num">#</span> 다음)에 담기므로 서버에는 남지 않지만,
                <strong> 암호화된 것은 아닙니다.</strong> 링크를 받은 사람은 위 내용을 그대로 볼
                수 있습니다. 단체 대화방에 붙이지 마시고, 필요한 가족에게만 보내세요.
              </p>
              <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  onClick={() => {
                    setConfirming(false);
                    void copyLink();
                  }}
                  style={{ ...btn, borderColor: "var(--primary)", color: "var(--primary)" }}
                >
                  이해했습니다, 링크 복사
                </button>
                <button onClick={() => setConfirming(false)} style={btn}>
                  취소
                </button>
              </div>
            </div>
          )}

          {manualUrl && (
            <div className="card" style={{ padding: "13px 16px" }}>
              <p style={{ margin: "0 0 8px", fontSize: 13 }}>
                이 환경에서는 자동 복사가 막혀 있습니다. 아래를 직접 복사해 주세요.
              </p>
              <input
                readOnly
                value={manualUrl}
                onFocus={(e) => e.currentTarget.select()}
                style={{ ...cell, width: "100%", fontFamily: "var(--font-mono, monospace)" }}
              />
              <button onClick={() => setManualUrl(null)} style={{ ...btn, marginTop: 9 }}>
                닫기
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

const btn: React.CSSProperties = {
  border: "1px solid var(--line-strong)",
  background: "var(--surface)",
  padding: "8px 15px",
  borderRadius: 2,
  cursor: "pointer",
  fontSize: 13.5,
  color: "var(--ink)",
};

const cell: React.CSSProperties = {
  border: "1px solid var(--line)",
  borderRadius: 2,
  padding: "4px 7px",
  fontSize: 13.5,
  background: "var(--surface)",
  color: "var(--ink)",
};
