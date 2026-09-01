"use client";

import { useMemo, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import {
  GRADE_LABEL,
  HOME_CARE_MONTHLY_CAP,
  HOME_CARE_MONTHLY_CAP_2025,
  FACILITY_DAILY_RATE,
  RATES_YEAR,
  type Grade,
  type CopayTier,
} from "@/lib/engine/rates";
import { calculateMonthlyCost, CARE_SETTING_LABEL, type CareSetting } from "@/lib/engine/cost";
import { money } from "@/lib/format";
import { PROGRAMS } from "@/lib/kb/programs";

/**
 * 돌봄 비용 지형
 *
 * 등급 × 돌봄 형태별 실부담을 한 표에 놓는다.
 * 이 조합을 한 곳에서 볼 수 있는 데가 없어서, 가족들은 형태를 바꿀 때마다
 * 처음부터 다시 알아본다.
 *
 * 모든 값은 2026년 고시 기준값으로 계산한 것이고 추정이 아니다.
 */

const GRADES: Grade[] = ["1", "2", "3", "4", "5", "cognitive"];
const SETTINGS: CareSetting[] = ["home", "daycare", "facility", "hospital", "family"];
const TIERS: { v: CopayTier; label: string }[] = [
  { v: "general", label: "일반" },
  { v: "reduced40", label: "경감 40%" },
  { v: "reduced60", label: "경감 60%" },
  { v: "basic", label: "기초생활수급" },
];

export default function Insights() {
  const [tier, setTier] = useState<CopayTier>("general");
  const [pilot, setPilot] = useState(false);

  const matrix = useMemo(
    () =>
      GRADES.map((g) => ({
        grade: g,
        cells: SETTINGS.map((s) => {
          const r = calculateMonthlyCost({
            grade: g,
            setting: s,
            copayTier: tier,
            caregiverType: "private",
            caregiverPilotEligible: pilot,
          });
          return { setting: s, total: r.monthlyTotal, unavailable: !!r.unavailable };
        }),
      })),
    [tier, pilot],
  );

  const max = Math.max(...matrix.flatMap((r) => r.cells.map((c) => c.total)));

  const capChange = GRADES.map((g) => ({
    grade: g,
    y2025: HOME_CARE_MONTHLY_CAP_2025[g],
    y2026: HOME_CARE_MONTHLY_CAP[g],
    delta: HOME_CARE_MONTHLY_CAP[g] - HOME_CARE_MONTHLY_CAP_2025[g],
    pct:
      ((HOME_CARE_MONTHLY_CAP[g] - HOME_CARE_MONTHLY_CAP_2025[g]) /
        HOME_CARE_MONTHLY_CAP_2025[g]) *
      100,
  }));

  const byBeneficiary = {
    recipient: PROGRAMS.filter((p) => p.beneficiary === "recipient").length,
    caregiver: PROGRAMS.filter((p) => p.beneficiary === "caregiver").length,
    both: PROGRAMS.filter((p) => p.beneficiary === "both").length,
  };

  return (
    <>
      <SiteHeader />

      <div className="shell" style={{ paddingTop: 44, paddingBottom: 90, display: "grid", gap: 36 }}>
        <div>
          <h1 style={{ fontSize: "clamp(23px, 3.4vw, 31px)", maxWidth: "22ch" }}>
            등급과 돌봄 형태를 바꾸면 부담이 얼마나 달라지나
          </h1>
          <p style={{ marginTop: 14, maxWidth: "62ch", fontSize: 15, color: "var(--ink-2)" }}>
            {RATES_YEAR}년 고시 기준값으로 계산한 월 실부담입니다. 추정이 아니라 고시 수치를 그대로
            적용했습니다. 가족들은 돌봄 형태를 바꿀 때마다 처음부터 다시 알아봐야 하는데, 그 조합을
            한 곳에 놓은 데가 없습니다.
          </p>
        </div>

        <section>
          <div
            style={{
              display: "flex",
              gap: 16,
              alignItems: "center",
              flexWrap: "wrap",
              marginBottom: 14,
            }}
          >
            <label style={{ display: "flex", gap: 7, alignItems: "center", fontSize: 13.5 }}>
              <span className="eyebrow">본인부담 구분</span>
              <select
                value={tier}
                onChange={(e) => setTier(e.target.value as CopayTier)}
                style={{
                  border: "1px solid var(--line-strong)",
                  borderRadius: 2,
                  padding: "5px 8px",
                  fontSize: 13.5,
                  background: "var(--surface)",
                  color: "var(--ink)",
                }}
              >
                {TIERS.map((t) => (
                  <option key={t.v} value={t.v}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "flex", gap: 7, alignItems: "center", fontSize: 13.5 }}>
              <input type="checkbox" checked={pilot} onChange={(e) => setPilot(e.target.checked)} />
              요양병원 간병비 급여화 대상
            </label>
            <span className="badge badge-rule">규칙 계산</span>
          </div>

          <div className="card scroll-x">
            <table className="data">
              <thead>
                <tr>
                  <th>등급</th>
                  {SETTINGS.map((s) => (
                    <th key={s} className="right">
                      {CARE_SETTING_LABEL[s]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.map((row) => (
                  <tr key={row.grade}>
                    <td style={{ fontWeight: 550, whiteSpace: "nowrap" }}>
                      {GRADE_LABEL[row.grade]}
                    </td>
                    {row.cells.map((c) => {
                      const ratio = max === 0 ? 0 : c.total / max;
                      return (
                        <td
                          key={c.setting}
                          className="right num"
                          style={{
                            background: c.unavailable
                              ? "var(--surface-sunk)"
                              : `color-mix(in srgb, var(--warn) ${Math.round(ratio * 22)}%, transparent)`,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {c.unavailable ? (
                            <span style={{ color: "var(--ink-3)" }}>이용 불가</span>
                          ) : (
                            money(c.total)
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ marginTop: 10, fontSize: 12.5, color: "var(--ink-3)" }}>
            배경색이 진할수록 부담이 큽니다. 인지지원등급은 방문요양·시설급여 대상이 아니라 해당 없음으로
            표시됩니다. 요양병원 값은 1:1 개인간병 기준입니다.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: 18, marginBottom: 5 }}>2026년 한도액 인상 폭</h2>
          <p style={{ margin: "0 0 13px", fontSize: 13.5, color: "var(--ink-2)" }}>
            중증(1·2등급) 인상 폭이 컸습니다. 등급별로 체감이 다릅니다.
          </p>
          <div className="card scroll-x">
            <table className="data">
              <thead>
                <tr>
                  <th>등급</th>
                  <th className="right">2025</th>
                  <th className="right">2026</th>
                  <th className="right">인상액</th>
                  <th className="right">인상률</th>
                </tr>
              </thead>
              <tbody>
                {capChange.map((r) => (
                  <tr key={r.grade}>
                    <td style={{ fontWeight: 550 }}>{GRADE_LABEL[r.grade]}</td>
                    <td className="right num" style={{ color: "var(--ink-3)" }}>
                      {money(r.y2025)}
                    </td>
                    <td className="right num">{money(r.y2026)}</td>
                    <td className="right num" style={{ color: "var(--accent)", fontWeight: 600 }}>
                      +{money(r.delta)}
                    </td>
                    <td className="right num" style={{ color: "var(--accent)" }}>
                      +{r.pct.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 style={{ fontSize: 18, marginBottom: 5 }}>제도는 누구를 위해 설계됐나</h2>
          <p style={{ margin: "0 0 13px", fontSize: 13.5, color: "var(--ink-2)" }}>
            지식베이스에 담긴 {PROGRAMS.length}개 제도를 수혜자 기준으로 나눈 것입니다.
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(158px, 1fr))",
              gap: 1,
              background: "var(--line)",
              border: "1px solid var(--line)",
            }}
          >
            <Cell label="돌봄 받는 사람 대상" value={`${byBeneficiary.recipient}개`} />
            <Cell label="돌보는 사람 대상" value={`${byBeneficiary.caregiver}개`} accent />
            <Cell label="둘 다" value={`${byBeneficiary.both}개`} />
            <Cell
              label="인지도 낮은 제도"
              value={`${PROGRAMS.filter((p) => p.awareness === "low").length}개`}
              warn
            />
          </div>
          <p style={{ marginTop: 11, fontSize: 13, color: "var(--ink-2)" }}>
            제도 대부분이 돌봄 받는 사람 중심으로 설계돼 있고, 돌보는 사람을 대상으로 하는 제도는
            인지도가 특히 낮습니다. 그래서 몰라서 못 받는 일이 반복됩니다.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: 18, marginBottom: 5 }}>시설급여 1일 수가</h2>
          <div className="card scroll-x">
            <table className="data">
              <thead>
                <tr>
                  <th>등급</th>
                  <th className="right">1일 수가</th>
                  <th className="right">월 급여비용 (30일)</th>
                  <th className="right">일반 본인부담 20%</th>
                </tr>
              </thead>
              <tbody>
                {GRADES.filter((g) => FACILITY_DAILY_RATE[g] > 0).map((g) => (
                  <tr key={g}>
                    <td style={{ fontWeight: 550 }}>{GRADE_LABEL[g]}</td>
                    <td className="right num">{money(FACILITY_DAILY_RATE[g])}</td>
                    <td className="right num">{money(FACILITY_DAILY_RATE[g] * 30)}</td>
                    <td className="right num" style={{ fontWeight: 600 }}>
                      {money(FACILITY_DAILY_RATE[g] * 30 * 0.2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ marginTop: 10, fontSize: 12.5, color: "var(--ink-3)" }}>
            여기에 비급여(식재료비·상급침실료·이미용·소모품)가 별도로 붙습니다. 많은 경우 비급여가
            본인부담보다 큽니다.
          </p>
        </section>
      </div>
    </>
  );
}

function Cell({
  label,
  value,
  accent,
  warn,
}: {
  label: string;
  value: string;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <div style={{ background: "var(--surface)", padding: "14px 16px" }}>
      <div className="eyebrow" style={{ marginBottom: 5 }}>{label}</div>
      <div
        className="num"
        style={{
          fontSize: 21,
          fontWeight: 600,
          color: warn ? "var(--warn)" : accent ? "var(--accent)" : "var(--ink)",
        }}
      >
        {value}
      </div>
    </div>
  );
}
