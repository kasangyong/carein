"use client";

import { useState } from "react";
import type { AnalyzeInput } from "@/lib/engine/analyze";
import type { Grade, CopayTier } from "@/lib/engine/rates";
import type { CareSetting } from "@/lib/engine/cost";
import { DocUpload } from "./DocUpload";

/**
 * 직접 입력.
 *
 * 프리셋만 있으면 "짜여진 데모" 의심을 못 지운다.
 * 심사위원이 자기가 아는 사례를 넣어볼 수 있어야 한다.
 */

const GRADES: { v: Grade | "none"; label: string }[] = [
  { v: "1", label: "1등급" },
  { v: "2", label: "2등급" },
  { v: "3", label: "3등급" },
  { v: "4", label: "4등급" },
  { v: "5", label: "5등급" },
  { v: "cognitive", label: "인지지원" },
  { v: "none", label: "등급 없음" },
];

const SETTINGS: { v: CareSetting; label: string }[] = [
  { v: "home", label: "재가 (방문요양)" },
  { v: "daycare", label: "주야간보호" },
  { v: "facility", label: "요양원" },
  { v: "hospital", label: "요양병원" },
  { v: "family", label: "가족 직접돌봄" },
];

const TIERS: { v: CopayTier; label: string }[] = [
  { v: "general", label: "일반" },
  { v: "reduced40", label: "경감 40%" },
  { v: "reduced60", label: "경감 60%" },
  { v: "basic", label: "기초생활수급" },
];

export function CaseForm({
  onSubmit,
  busy,
}: {
  onSubmit: (input: AnalyzeInput) => void;
  busy: boolean;
}) {
  const [grade, setGrade] = useState<Grade | "none">("3");
  const [setting, setSetting] = useState<CareSetting>("home");
  const [tier, setTier] = useState<CopayTier>("general");
  const [dementia, setDementia] = useState(false);
  const [remote, setRemote] = useState(false);
  const [caregiverType, setCaregiverType] = useState<"private" | "shared">("shared");

  const [recipientAge, setRecipientAge] = useState(80);
  const [recipientAssets, setRecipientAssets] = useState(5000);
  const [recipientIncome, setRecipientIncome] = useState(70);

  const [caregiverAge, setCaregiverAge] = useState(48);
  const [caregiverIncome, setCaregiverIncome] = useState(300);
  const [caregiverExpense, setCaregiverExpense] = useState(240);
  const [caregiverAssets, setCaregiverAssets] = useState(5000);
  const [tenure, setTenure] = useState(12);
  const [siblings, setSiblings] = useState(1);
  const [careMonths, setCareMonths] = useState(48);
  const [incomePct, setIncomePct] = useState(110);

  function build(): AnalyzeInput {
    const man = (n: number) => n * 10_000;
    return {
      profile: {
        recipientAge,
        ltcGrade: grade === "none" ? null : grade,
        hasDementiaDiagnosis: dementia,
        remoteArea: remote,
        incomePercentile: incomePct,
        copayTier: tier,
        careSetting: setting,
        caregiverEmployed: true,
        caregiverMonthlyIncome: man(caregiverIncome),
        caregiverAge,
        caregiverTenureYears: tenure,
        siblingCount: siblings,
      },
      finances: {
        recipientAssets: man(recipientAssets),
        recipientMonthlyIncome: man(recipientIncome),
        caregiverAssets: man(caregiverAssets),
        caregiverMonthlyIncome: man(caregiverIncome),
        caregiverMonthlyExpense: man(caregiverExpense),
        caregiverTenureYears: tenure,
        caregiverAge,
        siblingCount: siblings,
      },
      setting,
      horizonYears: 10,
      careDurationMonths: careMonths,
      costDetail: setting === "hospital" ? { caregiverType, caregiverPilotEligible: false } : {},
    };
  }

  return (
    <div className="card" style={{ padding: "18px 20px" }}>
      <DocUpload
        onExtracted={(p) => {
          if (p.ltcGrade) setGrade(p.ltcGrade);
          if (typeof p.recipientAge === "number") setRecipientAge(p.recipientAge);
          if (typeof p.hasDementiaDiagnosis === "boolean") setDementia(p.hasDementiaDiagnosis);
        }}
      />

      <hr className="rule" style={{ margin: "18px 0" }} />

      <p className="eyebrow" style={{ marginBottom: 12 }}>돌봄 받는 분</p>
      <div style={grid}>
        <Choice label="장기요양 등급" options={GRADES} value={grade} onChange={setGrade} />
        <Choice label="돌봄 형태" options={SETTINGS} value={setting} onChange={setSetting} />
        <Choice label="본인부담 구분" options={TIERS} value={tier} onChange={setTier} />
        <Num label="나이" value={recipientAge} onChange={setRecipientAge} unit="세" />
        <Num label="보유 자산" value={recipientAssets} onChange={setRecipientAssets} unit="만원" step={100} />
        <Num label="월 소득 (연금 등)" value={recipientIncome} onChange={setRecipientIncome} unit="만원" step={10} />
      </div>

      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 12 }}>
        <Check label="치매 진단을 받았습니다" checked={dementia} onChange={setDementia} />
        <Check
          label="장기요양기관이 부족한 지역입니다"
          checked={remote}
          onChange={setRemote}
          hint="도서·벽지 등. 가족요양비 요건입니다"
        />
      </div>

      {setting === "hospital" && (
        <div style={{ marginTop: 12 }}>
          <Choice
            label="간병 유형"
            options={[
              { v: "shared" as const, label: "공동간병" },
              { v: "private" as const, label: "1:1 개인간병" },
            ]}
            value={caregiverType}
            onChange={setCaregiverType}
          />
        </div>
      )}

      <hr className="rule" style={{ margin: "18px 0" }} />

      <p className="eyebrow" style={{ marginBottom: 12 }}>돌보는 분 (본인)</p>
      <div style={grid}>
        <Num label="나이" value={caregiverAge} onChange={setCaregiverAge} unit="세" />
        <Num label="월 소득" value={caregiverIncome} onChange={setCaregiverIncome} unit="만원" step={10} />
        <Num label="월 생활비" value={caregiverExpense} onChange={setCaregiverExpense} unit="만원" step={10} />
        <Num label="보유 자산" value={caregiverAssets} onChange={setCaregiverAssets} unit="만원" step={100} />
        <Num label="근속연수" value={tenure} onChange={setTenure} unit="년" />
        <Num label="함께 부담할 형제" value={siblings} onChange={setSiblings} unit="명" />
        <Num label="예상 돌봄 기간" value={careMonths} onChange={setCareMonths} unit="개월" step={6} />
        <Num
          label="부모 소득 기준 중위소득 대비"
          value={incomePct}
          onChange={setIncomePct}
          unit="%"
          step={10}
        />
      </div>

      <button
        onClick={() => onSubmit(build())}
        disabled={busy}
        style={{
          marginTop: 20,
          border: "1px solid var(--primary)",
          background: busy ? "var(--surface-sunk)" : "var(--primary)",
          color: busy ? "var(--ink-3)" : "#fff",
          padding: "11px 20px",
          borderRadius: 2,
          cursor: busy ? "wait" : "pointer",
          fontSize: 14.5,
          fontWeight: 500,
        }}
      >
        {busy ? "계산 중…" : "계산해 보기"}
      </button>
    </div>
  );
}

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(184px, 1fr))",
  gap: 12,
};

function Choice<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { v: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <label style={{ display: "block" }}>
      <span className="eyebrow" style={{ display: "block", marginBottom: 5 }}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        style={field}
      >
        {options.map((o) => (
          <option key={o.v} value={o.v}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Num({
  label,
  value,
  onChange,
  unit,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  unit: string;
  step?: number;
}) {
  return (
    <label style={{ display: "block" }}>
      <span className="eyebrow" style={{ display: "block", marginBottom: 5 }}>{label}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input
          type="number"
          value={value}
          step={step}
          min={0}
          onChange={(e) => onChange(Number(e.target.value))}
          className="num"
          style={{ ...field, textAlign: "right" }}
        />
        <span style={{ fontSize: 12.5, color: "var(--ink-3)", flexShrink: 0 }}>{unit}</span>
      </span>
    </label>
  );
}

function Check({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <label style={{ display: "flex", gap: 7, alignItems: "flex-start", cursor: "pointer" }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ marginTop: 3 }}
      />
      <span>
        <span style={{ fontSize: 13.5 }}>{label}</span>
        {hint && (
          <span style={{ display: "block", fontSize: 12, color: "var(--ink-3)" }}>{hint}</span>
        )}
      </span>
    </label>
  );
}

const field: React.CSSProperties = {
  width: "100%",
  border: "1px solid var(--line-strong)",
  borderRadius: 2,
  padding: "7px 9px",
  fontSize: 14,
  background: "var(--surface)",
  color: "var(--ink)",
};
