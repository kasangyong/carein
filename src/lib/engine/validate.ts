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

  if (!isObject(raw.finances)) return "finances 가 없습니다.";
  const f = raw.finances;
  for (const key of FINANCE_FIELDS) {
    const v = f[key];
    if (typeof v !== "number" || !Number.isFinite(v)) {
      return `finances.${key} 는 숫자여야 합니다.`;
    }
    if (v < 0) return `finances.${key} 는 0 이상이어야 합니다.`;
  }

  for (const key of ["horizonYears", "careDurationMonths"] as const) {
    const v = raw[key];
    if (v !== undefined && (typeof v !== "number" || !Number.isFinite(v) || v <= 0)) {
      return `${key} 는 0보다 큰 숫자여야 합니다.`;
    }
  }

  return null;
}

export function assertAnalyzeInput(raw: unknown): AnalyzeInput {
  const reason = validateAnalyzeInput(raw);
  if (reason) throw new Error(reason);
  return raw as AnalyzeInput;
}
