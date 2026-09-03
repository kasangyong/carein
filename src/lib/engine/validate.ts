/**
 * 입력 검증 (RULE)
 *
 * 이 서비스의 첫 번째 규칙은 "모르면 해당한다고 말하지 않는다"이다.
 * 그런데 API 는 setting 에 "MARS" 가 들어와도 200 으로 숫자를 돌려줬다.
 * 말이 안 되는 입력에 그럴듯한 답을 주는 건 모르면서 아는 척하는 것과 같다.
 *
 * 그래서 계산 전에 값의 형태를 본다. 통과 못 하면 어느 필드가 왜 틀렸는지 말한다.
 */

import type { AnalyzeInput } from "./analyze";

const SETTINGS = ["home", "daycare", "facility", "hospital", "family"] as const;
const GRADES = ["1", "2", "3", "4", "5", "cognitive"] as const;
const TIERS = ["general", "reduced40", "reduced60", "basic"] as const;

/** 화면에서 조정할 수 있는 가정과 허용 범위 */
export const ASSUMPTION_BOUNDS: Record<string, [number, number]> = {
  wageScarRate: [0, 0.6],
  reemploymentDelayMonths: [0, 60],
  wageGrowthRate: [0, 0.15],
  careCostInflation: [0, 0.15],
  pensionReplacementPerYear: [0, 0.05],
  localHealthInsuranceMonthly: [0, 1_000_000],
};

const FINANCE_FIELDS = [
  "recipientAssets",
  "recipientMonthlyIncome",
  "caregiverAssets",
  "caregiverMonthlyIncome",
  "caregiverMonthlyExpense",
  "caregiverTenureYears",
  "caregiverAge",
  "siblingCount",
] as const;

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** 통과하면 null, 아니면 사람이 읽을 수 있는 사유 */
export function validateAnalyzeInput(raw: unknown): string | null {
  if (!isObject(raw)) return "input 은 객체여야 합니다.";

  if (!SETTINGS.includes(raw.setting as (typeof SETTINGS)[number])) {
    return `setting 값이 올바르지 않습니다. ${SETTINGS.join(" · ")} 중 하나여야 합니다.`;
  }

  if (!isObject(raw.profile)) return "profile 이 없습니다.";
  const p = raw.profile;

  // 등급은 없을 수 있다. 없는 것과 이상한 값은 다르다.
  if (p.ltcGrade !== undefined && p.ltcGrade !== null) {
    if (!GRADES.includes(p.ltcGrade as (typeof GRADES)[number])) {
      return `ltcGrade 값이 올바르지 않습니다. ${GRADES.join(" · ")} 중 하나이거나 null 이어야 합니다.`;
    }
  }
  if (p.copayTier !== undefined && !TIERS.includes(p.copayTier as (typeof TIERS)[number])) {
    return `copayTier 값이 올바르지 않습니다. ${TIERS.join(" · ")} 중 하나여야 합니다.`;
  }

  // 나이·기간은 형태만 맞으면 통과했다. recipientAge 200 이 200 OK 로 계산됐다.
  // 말이 안 되는 값에 그럴듯한 숫자를 주지 않는다.
  const ranges: [string, unknown, number, number, string][] = [
    ["profile.recipientAge", p.recipientAge, 40, 120, "세"],
    ["profile.caregiverAge", p.caregiverAge, 15, 100, "세"],
    ["profile.incomePercentile", p.incomePercentile, 0, 1000, "%"],
    ["profile.siblingCount", p.siblingCount, 0, 15, "명"],
  ];
  for (const [name, v, lo, hi, unit] of ranges) {
    if (v === undefined || v === null) continue;
    if (typeof v !== "number" || !Number.isFinite(v) || v < lo || v > hi) {
      return `${name} 는 ${lo}~${hi}${unit} 범위여야 합니다.`;
    }
  }

  if (!isObject(raw.finances)) return "finances 가 없습니다.";
  const f = raw.finances;
  for (const key of FINANCE_FIELDS) {
    const v = f[key];
    if (typeof v !== "number" || !Number.isFinite(v)) {
      return `finances.${key} 는 숫자여야 합니다.`;
    }
    if (v < 0) return `finances.${key} 는 0 이상이어야 합니다.`;
  }

  const spans: [string, unknown, number, number, string][] = [
    ["horizonYears", raw.horizonYears, 1, 40, "년"],
    ["careDurationMonths", raw.careDurationMonths, 1, 360, "개월"],
  ];
  for (const [name, v, lo, hi, unit] of spans) {
    if (v === undefined) continue;
    if (typeof v !== "number" || !Number.isFinite(v) || v < lo || v > hi) {
      return `${name} 는 ${lo}~${hi}${unit} 범위여야 합니다.`;
    }
  }

  // 자녀 나이가 부모보다 많으면 프로파일이 뒤바뀐 것이다.
  if (
    typeof p.recipientAge === "number" &&
    typeof p.caregiverAge === "number" &&
    p.caregiverAge >= p.recipientAge
  ) {
    return "돌보는 사람의 나이가 돌봄 대상자보다 많습니다. 두 값이 뒤바뀌었는지 확인해 주세요.";
  }

  // 상한 — 오타로 0 을 하나 더 붙인 값이 그대로 계산되면 결과가 무의미해진다
  const CAPS: Record<string, number> = {
    recipientAssets: 100_000_000_000,
    caregiverAssets: 100_000_000_000,
    recipientMonthlyIncome: 1_000_000_000,
    caregiverMonthlyIncome: 1_000_000_000,
    caregiverMonthlyExpense: 1_000_000_000,
    caregiverTenureYears: 60,
    caregiverAge: 100,
    siblingCount: 15,
  };
  for (const key of FINANCE_FIELDS) {
    const v = f[key] as number;
    if (v > CAPS[key]) return `finances.${key} 값이 허용 범위를 넘습니다.`;
  }

  // 가정 덮어쓰기 — 허용 키와 범위 안에서만 받는다.
  // 임금 하락률에 999 가 들어오면 결과가 아무 뜻도 없어진다.
  if (raw.assumptionOverrides !== undefined) {
    if (!isObject(raw.assumptionOverrides)) {
      return "assumptionOverrides 는 객체여야 합니다.";
    }
    for (const [k, v] of Object.entries(raw.assumptionOverrides)) {
      const bound = ASSUMPTION_BOUNDS[k];
      if (!bound) return `조정할 수 없는 가정입니다: ${k}`;
      if (typeof v !== "number" || !Number.isFinite(v) || v < bound[0] || v > bound[1]) {
        return `${k} 는 ${bound[0]}~${bound[1]} 범위여야 합니다.`;
      }
    }
  }

  return null;
}

export function assertAnalyzeInput(raw: unknown): AnalyzeInput {
  const reason = validateAnalyzeInput(raw);
  if (reason) throw new Error(reason);
  return raw as AnalyzeInput;
}
