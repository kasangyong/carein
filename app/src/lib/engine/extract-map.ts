/**
 * 판독 결과 → 프로파일 매핑 (RULE)
 *
 * LLM이 읽어온 값을 그대로 믿지 않는다.
 *  1. 허용된 값 집합에 없으면 버린다.
 *  2. 신뢰도 임계치 미달이면 프로파일에 안 넣고 "확인 필요"로 뺀다.
 *  3. 버린 이유를 전부 돌려준다. 조용히 삼키지 않는다.
 */

import type { ExtractResult } from "../ai/provider";
import type { CareProfile } from "./match";
import type { Grade } from "./rates";

const CONFIDENCE_THRESHOLD = 0.6;

const GRADE_ALIASES: Record<string, Grade> = {
  "1": "1", "1등급": "1", "일등급": "1",
  "2": "2", "2등급": "2", "이등급": "2",
  "3": "3", "3등급": "3", "삼등급": "3",
  "4": "4", "4등급": "4", "사등급": "4",
  "5": "5", "5등급": "5", "오등급": "5",
  인지지원: "cognitive",
  인지지원등급: "cognitive",
  cognitive: "cognitive",
};

const DEMENTIA_CODES = /^(F0[0-3]|G30)/i;

export interface MapResult {
  profile: Partial<CareProfile>;
  /** 신뢰도가 낮아 반영하지 않은 필드 */
  lowConfidence: { field: string; value: unknown; confidence: number }[];
  /** 허용값이 아니라 버린 필드 */
  rejected: { field: string; value: unknown; reason: string }[];
  threshold: number;
}

export function mapExtractionToProfile(x: ExtractResult): MapResult {
  const profile: Partial<CareProfile> = {};
  const lowConfidence: MapResult["lowConfidence"] = [];
  const rejected: MapResult["rejected"] = [];

  const f = x.fields ?? {};
  const c = x.confidence ?? {};

  const conf = (key: string) => {
    const v = c[key];
    return typeof v === "number" ? v : 0;
  };

  /** 값을 쓸 수 있는지 판단하고, 못 쓰면 이유를 기록한다 */
  function take<T>(
    keys: string[],
    parse: (raw: unknown) => T | null,
    assign: (v: T) => void,
    label: string,
  ) {
    for (const k of keys) {
      const raw = f[k];
      if (raw === undefined || raw === null || raw === "") continue;

      const parsed = parse(raw);
      if (parsed === null) {
        rejected.push({ field: label, value: raw, reason: "허용된 값 형식이 아닙니다" });
        return;
      }
      const cf = conf(k);
      if (cf < CONFIDENCE_THRESHOLD) {
        lowConfidence.push({ field: label, value: raw, confidence: cf });
        return;
      }
      assign(parsed);
      return;
    }
  }

  take(
    ["장기요양등급", "등급", "ltcGrade", "grade"],
    (raw) => {
      const key = String(raw).trim().replace(/\s/g, "");
      return GRADE_ALIASES[key] ?? null;
    },
    (v) => {
      profile.ltcGrade = v;
    },
    "장기요양 등급",
  );

  take(
    ["나이", "연세", "age", "recipientAge"],
    (raw) => {
      const n = Number(String(raw).replace(/[^\d]/g, ""));
      return Number.isFinite(n) && n >= 0 && n <= 130 ? n : null;
    },
    (v) => {
      profile.recipientAge = v;
    },
    "수급자 나이",
  );

  take(
    ["생년월일", "birthDate", "birth"],
    (raw) => {
      const m = String(raw).match(/(19|20)\d{2}/);
      if (!m) return null;
      const year = Number(m[0]);
      const age = new Date().getFullYear() - year;
      return age >= 0 && age <= 130 ? age : null;
    },
    (v) => {
      if (profile.recipientAge === undefined) profile.recipientAge = v;
    },
    "생년월일에서 계산한 나이",
  );

  take(
    ["상병코드", "질병코드", "diagnosisCode", "icd"],
    (raw) => {
      const code = String(raw).trim().toUpperCase();
      return DEMENTIA_CODES.test(code) ? true : false;
    },
    (v) => {
      profile.hasDementiaDiagnosis = v;
    },
    "치매 진단 여부",
  );

  take(
    ["진단명", "diagnosis"],
    (raw) => {
      const s = String(raw);
      return /치매|알츠하이머|dementia|alzheimer/i.test(s) ? true : null;
    },
    (v) => {
      if (profile.hasDementiaDiagnosis === undefined) profile.hasDementiaDiagnosis = v;
    },
    "진단명",
  );

  take(
    ["주소", "거주지", "region", "address"],
    (raw) => {
      const s = String(raw).trim();
      return s.length >= 2 && s.length <= 60 ? s : null;
    },
    (v) => {
      profile.region = v;
    },
    "거주지",
  );

  return { profile, lowConfidence, rejected, threshold: CONFIDENCE_THRESHOLD };
}
