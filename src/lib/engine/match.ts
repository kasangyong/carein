/**
 * 제도 자격 판정 엔진 (RULE)
 *
 * LLM은 이 판정에 관여하지 않는다. 규칙 대조만으로 결정한다.
 * LLM이 하는 일은 (1) 문서에서 프로파일 값을 뽑는 것 (2) 결과를 사람 말로 설명하는 것뿐이다.
 *
 * 판정은 3값이다: 해당 / 미해당 / 확인필요.
 * 값을 모르면 "해당"이라고 하지 않는다. 이게 M9.1 근거 강제의 핵심이다.
 */

import { PROGRAMS, type Program, type EligibilityRule } from "../kb/programs";
import type { Grade, CopayTier } from "./rates";
import type { CareSetting } from "./cost";

export interface CareProfile {
  /** 돌봄 대상자 (부모) */
  recipientAge?: number;
  ltcGrade?: Grade | null;
  hasDementiaDiagnosis?: boolean;
  remoteArea?: boolean;
  incomePercentile?: number;
  copayTier?: CopayTier;
  careSetting?: CareSetting;
  region?: string;

  /** 돌보는 사람 (자녀) */
  caregiverEmployed?: boolean;
  caregiverMonthlyIncome?: number;
  caregiverAge?: number;
  caregiverTenureYears?: number;
  siblingCount?: number;
}

export type Verdict = "eligible" | "ineligible" | "unknown";

export interface RuleCheck {
  rule: EligibilityRule;
  verdict: Verdict;
  /** 실제 값 (있으면) */
  actual?: unknown;
}

export interface MatchResult {
  program: Program;
  verdict: Verdict;
  checks: RuleCheck[];
  /** 판정을 막은 미확인 항목 */
  missing: string[];
  /** 선행 제도 미충족 */
  blockedBy: string[];
  /** 배타 관계로 동시 수급 불가 */
  conflictsWith: string[];
  /** 금액 합계에 넣어도 되는가 */
  countable: boolean;
  monthlyAmount: number | null;
}

function evalRule(rule: EligibilityRule, p: CareProfile): RuleCheck {
  const actual = (p as Record<string, unknown>)[rule.field];

  if (actual === undefined || actual === null) {
    return { rule, verdict: "unknown" };
  }

  let pass = false;
  switch (rule.op) {
    case "exists":
      pass = actual !== null && actual !== undefined;
      break;
    case "eq":
      pass = actual === rule.value;
      break;
    case "in":
      pass = Array.isArray(rule.value) && (rule.value as unknown[]).includes(actual);
      break;
    case "gte":
      pass = typeof actual === "number" && actual >= (rule.value as number);
      break;
    case "lte":
      pass = typeof actual === "number" && actual <= (rule.value as number);
      break;
  }

  return { rule, verdict: pass ? "eligible" : "ineligible", actual };
}

function matchOne(program: Program, profile: CareProfile, eligibleIds: Set<string>): MatchResult {
  const checks = program.rules.map((r) => evalRule(r, profile));

  const failed = checks.filter((c) => c.verdict === "ineligible");
  const missing = checks.filter((c) => c.verdict === "unknown").map((c) => c.rule.describe);

  const blockedBy = (program.requires ?? []).filter((id) => !eligibleIds.has(id));
  const conflictsWith = (program.exclusiveWith ?? []).filter((id) => eligibleIds.has(id));

  let verdict: Verdict;
  if (failed.length > 0) verdict = "ineligible";
  else if (blockedBy.length > 0) verdict = "ineligible";
  else if (conflictsWith.length > 0) verdict = "ineligible";
  else if (missing.length > 0) verdict = "unknown";
  else verdict = "eligible";

  // 금액에 넣으려면: 해당 판정 + 출처 확인됨 + 금액이 있음
  const countable =
    verdict === "eligible" && program.verified === "confirmed" && program.monthlyAmount !== null;

  return {
    program,
    verdict,
    checks,
    missing,
    blockedBy,
    conflictsWith,
    countable,
    monthlyAmount: program.monthlyAmount,
  };
}

export interface MatchSummary {
  eligible: MatchResult[];
  unknown: MatchResult[];
  ineligible: MatchResult[];
  /** 합산 가능한 월 지원액 */
  countableMonthlyTotal: number;
  /** 확인만 되면 추가로 받을 수 있는 잠재 월액 */
  potentialMonthlyTotal: number;
  /** 놓치기 쉬운 제도 중 해당·확인필요인 것 */
  overlooked: MatchResult[];
  /** 신청 순서 (선행 요건 위상정렬) */
  applicationOrder: string[];
}

export function matchPrograms(profile: CareProfile): MatchSummary {
  // 1차: 선행 요건 없는 제도부터 판정해 eligibleIds 확보
  const eligibleIds = new Set<string>();
  const noReq = PROGRAMS.filter((p) => !p.requires || p.requires.length === 0);
  for (const p of noReq) {
    const r = matchOne(p, profile, eligibleIds);
    if (r.verdict === "eligible") eligibleIds.add(p.id);
  }

  // 2차: 전체 판정 (선행 요건 반영)
  const results = PROGRAMS.map((p) => matchOne(p, profile, eligibleIds));

  const eligible = results.filter((r) => r.verdict === "eligible");
  const unknown = results.filter((r) => r.verdict === "unknown");
  const ineligible = results.filter((r) => r.verdict === "ineligible");

  const countableMonthlyTotal = eligible
    .filter((r) => r.countable)
    .reduce((s, r) => s + (r.monthlyAmount ?? 0), 0);

  const potentialMonthlyTotal = unknown.reduce((s, r) => s + (r.monthlyAmount ?? 0), 0);

  const overlooked = [...eligible, ...unknown].filter((r) => r.program.awareness === "low");

  return {
    eligible,
    unknown,
    ineligible,
    countableMonthlyTotal,
    potentialMonthlyTotal,
    overlooked,
    applicationOrder: topoSort([...eligible, ...unknown].map((r) => r.program)),
  };
}

/** 선행 요건 그래프 위상정렬 — 신청 순서 */
function topoSort(programs: Program[]): string[] {
  const ids = new Set(programs.map((p) => p.id));
  const visited = new Set<string>();
  const order: string[] = [];

  function visit(p: Program) {
    if (visited.has(p.id)) return;
    visited.add(p.id);
    for (const dep of p.requires ?? []) {
      if (ids.has(dep)) {
        const depProgram = programs.find((x) => x.id === dep);
        if (depProgram) visit(depProgram);
      }
    }
    order.push(p.id);
  }

  for (const p of programs) visit(p);
  return order;
}
