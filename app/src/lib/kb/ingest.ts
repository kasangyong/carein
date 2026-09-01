/**
 * 공공데이터 복지서비스 색인 파이프라인
 *
 * 대회가 데이터를 제공하지 않으므로 전량 공개 API에서 가져온다.
 *
 *   한국사회보장정보원_중앙부처복지서비스   (목록 + 상세)
 *   한국사회보장정보원_지자체복지서비스
 *   행정안전부_대한민국 공공서비스(혜택) 정보
 *
 * 인증키(data.go.kr)가 없으면 색인을 건너뛰고 시드 지식베이스만 쓴다.
 * 조용히 빈 결과를 내놓지 않고, 왜 건너뛰었는지 반환한다.
 *
 * 실행: npm run ingest
 */

import type { Program, EligibilityRule } from "./programs";

const BASE_CENTRAL = "https://apis.data.go.kr/B554287/NationalWelfareInformationsV001";
const BASE_LOCAL = "https://apis.data.go.kr/B554287/LocalGovernmentWelfareInformations";

export interface IngestOptions {
  serviceKey?: string;
  /** 가져올 최대 건수. 색인 시간 조절용 */
  limit?: number;
  /** 지자체 제도를 가져올 시도 코드 */
  regions?: string[];
}

export interface IngestReport {
  ok: boolean
  skippedReason?: string;
  fetched: number;
  normalized: number;
  dropped: { title: string; reason: string }[];
  programs: Program[];
}

interface RawWelfareItem {
  servId?: string;
  servNm?: string;
  jurMnofNm?: string;
  jurOrgNm?: string;
  servDgst?: string;
  lifeArray?: string;
  trgterIndvdlArray?: string;
  intrsThemaArray?: string;
  sprtCycNm?: string;
  srvPvsnNm?: string;
  aplyMtdNm?: string;
}

/**
 * 지원대상 자연어에서 기계 판정 가능한 규칙을 뽑는다.
 * 확실히 읽히는 것만 규칙으로 만들고, 나머지는 규칙 없이 남긴다.
 * 규칙이 없으면 판정이 "확인 필요"로 떨어지므로 안전한 쪽으로 실패한다.
 */
export function deriveRules(text: string): EligibilityRule[] {
  const rules: EligibilityRule[] = [];
  if (!text) return rules;

  const ageMatch = text.match(/만\s*(\d{2})\s*세\s*이상/);
  if (ageMatch) {
    rules.push({
      field: "recipientAge",
      op: "gte",
      value: Number(ageMatch[1]),
      describe: `만 ${ageMatch[1]}세 이상`,
    });
  }

  const incomeMatch = text.match(/중위소득\s*(\d{2,3})\s*%\s*이하/);
  if (incomeMatch) {
    rules.push({
      field: "incomePercentile",
      op: "lte",
      value: Number(incomeMatch[1]),
      describe: `기준 중위소득 ${incomeMatch[1]}% 이하`,
    });
  }

  if (/장기요양\s*(등급|인정)/.test(text)) {
    rules.push({
      field: "ltcGrade",
      op: "exists",
      value: true,
      describe: "장기요양 등급 보유",
    });
  }

  if (/치매/.test(text)) {
    rules.push({
      field: "hasDementiaDiagnosis",
      op: "eq",
      value: true,
      describe: "치매 진단",
    });
  }

  return rules;
}

/** 지원내용 자연어에서 월 환산 금액을 뽑는다. 확실할 때만. */
export function deriveAmount(text: string): { monthlyAmount: number | null; kind: Program["amountKind"] } {
  if (!text) return { monthlyAmount: null, kind: "in-kind" };

  const monthly = text.match(/월\s*([\d,]+)\s*(원|만원)/);
  if (monthly) {
    const n = Number(monthly[1].replace(/,/g, ""));
    const amount = monthly[2] === "만원" ? n * 10_000 : n;
    return { monthlyAmount: amount, kind: /한도|이내|까지/.test(text) ? "cap" : "fixed" };
  }

  const yearly = text.match(/연\s*([\d,]+)\s*(원|만원)/);
  if (yearly) {
    const n = Number(yearly[1].replace(/,/g, ""));
    const amount = (yearly[2] === "만원" ? n * 10_000 : n) / 12;
    return { monthlyAmount: Math.round(amount), kind: "cap" };
  }

  return { monthlyAmount: null, kind: /서비스|지원|제공|교육|상담/.test(text) ? "in-kind" : "varies" };
}

/** 돌봄과 무관한 제도는 색인에서 제외한다 */
const CARE_KEYWORDS =
  /노인|고령|치매|장기요양|요양|돌봄|간병|부양|가족돌봄|재가|경로당|실버|중증|재활|간호/;

export function normalize(raw: RawWelfareItem, source: string): Program | null {
  const name = raw.servNm?.trim();
  if (!name) return null;

  const target = raw.trgterIndvdlArray ?? "";
  const digest = raw.servDgst ?? "";
  const haystack = `${name} ${target} ${digest} ${raw.intrsThemaArray ?? ""}`;

  if (!CARE_KEYWORDS.test(haystack)) return null;

  const { monthlyAmount, kind } = deriveAmount(digest);

  return {
    id: `pub-${raw.servId ?? name.replace(/\s/g, "-")}`,
    name,
    authority: raw.jurOrgNm || raw.jurMnofNm || "미확인",
    summary: digest.slice(0, 160) || "지원 내용은 소관 기관에서 확인이 필요합니다.",
    benefit: digest || "지원 내용 미기재",
    monthlyAmount,
    amountKind: kind,
    applyAt: raw.aplyMtdNm || "소관 기관 문의",
    legalBasis: "공공데이터 복지서비스 정보 (근거 법령 개별 확인 필요)",
    source,
    // API에서 온 항목은 원문 대조를 거치지 않았으므로 확인 필요로 둔다.
    verified: "needs-check",
    caveat:
      "공공데이터 API에서 자동 색인한 항목입니다. 지원 요건과 금액은 소관 기관 원문으로 확인해야 합니다.",
    rules: deriveRules(`${target} ${digest}`),
    awareness: "medium",
    beneficiary: /가족|보호자|부양/.test(haystack) ? "caregiver" : "recipient",
    tags: ["공공데이터", ...(raw.intrsThemaArray ? [raw.intrsThemaArray] : [])],
  };
}

export async function ingestCentral(opts: IngestOptions = {}): Promise<IngestReport> {
  const key = opts.serviceKey ?? process.env.DATA_GO_KR_KEY;
  const limit = opts.limit ?? 300;

  if (!key) {
    return {
      ok: false,
      skippedReason:
        "DATA_GO_KR_KEY 가 없습니다. 공공데이터포털에서 '한국사회보장정보원_중앙부처복지서비스' 활용신청 후 인증키를 .env.local 에 넣으세요. 키가 없어도 시드 지식베이스로 서비스는 동작합니다.",
      fetched: 0,
      normalized: 0,
      dropped: [],
      programs: [],
    };
  }

  const dropped: IngestReport["dropped"] = [];
  const programs: Program[] = [];
  let fetched = 0;

  const perPage = 100;
  const pages = Math.ceil(limit / perPage);

  for (let page = 1; page <= pages; page++) {
    const url =
      `${BASE_CENTRAL}/NationalWelfarelistV001?serviceKey=${encodeURIComponent(key)}` +
      `&callTp=L&pageNo=${page}&numOfRows=${perPage}&srchKeyCode=003`;

    const res = await fetch(url);
    if (!res.ok) {
      return {
        ok: false,
        skippedReason: `중앙부처 복지서비스 API 응답 실패 (HTTP ${res.status}). 인증키 승인 여부를 확인하세요.`,
        fetched,
        normalized: programs.length,
        dropped,
        programs,
      };
    }

    const xml = await res.text();
    const items = parseItems(xml);
    if (items.length === 0) break;
    fetched += items.length;

    for (const it of items) {
      const p = normalize(it, "공공데이터포털 한국사회보장정보원_중앙부처복지서비스");
      if (p) programs.push(p);
      else dropped.push({ title: it.servNm ?? "(제목 없음)", reason: "돌봄과 무관" });
    }
  }

  return { ok: true, fetched, normalized: programs.length, dropped, programs };
}

/** XML 응답에서 item 목록을 뽑는다. 의존성 없이 처리한다. */
export function parseItems(xml: string): RawWelfareItem[] {
  const out: RawWelfareItem[] = [];
  const blocks = xml.match(/<servList>[\s\S]*?<\/servList>/g) ?? xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];

  for (const b of blocks) {
    const get = (tag: string) => {
      const m = b.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
      if (!m) return undefined;
      return m[1]
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .trim();
    };
    out.push({
      servId: get("servId"),
      servNm: get("servNm"),
      jurMnofNm: get("jurMnofNm"),
      jurOrgNm: get("jurOrgNm"),
      servDgst: get("servDgst"),
      lifeArray: get("lifeArray"),
      trgterIndvdlArray: get("trgterIndvdlArray"),
      intrsThemaArray: get("intrsThemaArray"),
      sprtCycNm: get("sprtCycNm"),
      srvPvsnNm: get("srvPvsnNm"),
      aplyMtdNm: get("aplyMtdNm"),
    });
  }
  return out;
}

export { BASE_CENTRAL, BASE_LOCAL };
