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

  function update(id: string, patch: Partial<Contributor>) {
    setPeople((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  async function share() {
    if (!input) return;
    const url = buildShareUrl(input);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      window.prompt("이 링크를 복사해 가족에게 보내세요", url);
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
        <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={share}
            style={{
              border: "1px solid var(--line-strong)",
              background: "var(--surface)",
              padding: "8px 15px",
              borderRadius: 2,
              cursor: "pointer",
              fontSize: 13.5,
            }}
          >
            {copied ? "링크를 복사했습니다" : "가족에게 공유할 링크 만들기"}
          </button>
          <span style={{ fontSize: 12.5, color: "var(--ink-3)" }}>
            링크에 사례가 담깁니다. 서버에 저장하지 않습니다.
          </span>
        </div>
      )}
    </>
  );
}

const cell: React.CSSProperties = {
  border: "1px solid var(--line)",
  borderRadius: 2,
  padding: "4px 7px",
  fontSize: 13.5,
  background: "var(--surface)",
  color: "var(--ink)",
};
