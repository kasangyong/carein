/**
 * 돌봄 관련 제도 지식베이스 (시드)
 *
 * 이 파일은 공공데이터포털 복지서비스 API 색인이 붙기 전의 시드 데이터다.
 * API 연동 후에는 이 구조로 정규화하여 병합한다. (src/lib/kb/ingest.ts)
 *
 * 정직성 규칙
 *  - verified: "confirmed" 인 값만 판정 결과에 단정적으로 쓴다.
 *  - "needs-check" 는 화면에서 "확인 필요"로 표시하고 금액 합계에서 제외한다.
 *  - 모든 항목에 source 를 단다. 출처 없는 항목은 KB에 넣지 않는다.
 */

export type VerificationStatus = "confirmed" | "needs-check";

/**
 * 금액 환산 방식.
 *
 * 현금 지급(monthlyAmount)이 아닌 제도도 재무에는 영향을 준다.
 * 다만 근거가 있는 것만 환산한다 — 연간 정산이나 개별 심사로 정해지는
 * 제도는 여기에 넣지 않고 금액 없이 "확인 필요"로 남긴다.
 */
export type Valuation =
  /** 연 한도 안에서 공단이 대주는 제도 (복지용구) */
  | { kind: "annualCap"; annualLimit: number }
  /** 본인부담률 자체가 낮아지는 제도 (장기요양 본인부담금 감경) */
  | { kind: "copayReduction" };

/** 기계 판정 가능한 조건 */
export interface EligibilityRule {
  field:
    | "ltcGrade"
    | "recipientAge"
    | "caregiverEmployed"
    | "incomePercentile"
    | "hasDementiaDiagnosis"
    | "remoteArea"
    | "copayTier"
    | "careSetting"
    | "livesAlone"
    | "hasFamilySupport"
    | "caregiverHasCareWorkerCert";
  op: "in" | "gte" | "lte" | "eq" | "exists";
  value: unknown;
  /** 이 조건을 사람 말로 */
  describe: string;
}

export interface Program {
  id: string;
  name: string;
  /** 소관 기관 */
  authority: string;
  /** 한 줄 요약 */
  summary: string;
  /** 행정 용어를 걷어낸 요약. 현재 화면에서는 쓰지 않는다(쉬운 말 모드 제거) */
  plainSummary?: string;
  /** 지원 내용 원문에 가까운 서술 */
  benefit: string;
  /** 월 환산 금액 (원). null 이면 금액 산정 불가 (현물·서비스) */
  monthlyAmount: number | null;
  /** 현금이 아닌 제도의 월 환산 근거. 없으면 금액을 말하지 않는다 */
  valuation?: Valuation;
  /** 금액이 상한인지 정액인지 */
  amountKind: "fixed" | "cap" | "in-kind" | "varies";
  /** 신청처 */
  applyAt: string;
  /** 근거 법령·고시 */
  legalBasis: string;
  /** 우리가 확인한 출처 */
  source: string;
  verified: VerificationStatus;
  /** 확인 필요 사유 */
  caveat?: string;
  rules: EligibilityRule[];
  /** 이 제도와 동시에 받을 수 없는 제도 id */
  exclusiveWith?: string[];
  /** 이 제도를 받으려면 먼저 있어야 하는 제도 id */
  requires?: string[];
  /** 인지도 — low 면 "놓치기 쉬운 제도"로 강조 */
  awareness: "high" | "medium" | "low";
  /** 수혜자가 부모인가 돌보는 자녀인가 */
  beneficiary: "recipient" | "caregiver" | "both";
  tags: string[];
}

export const PROGRAMS: Program[] = [
  {
    id: "ltc-benefit",
    name: "노인장기요양보험 급여",
    authority: "국민건강보험공단",
    summary: "등급 판정을 받으면 재가·시설 급여 비용의 대부분을 공단이 부담합니다.",
    plainSummary: "나라에서 요양 비용의 대부분을 내줍니다. 등급을 받아야 시작됩니다.",
    benefit:
      "등급별 월 한도액 내에서 방문요양·주야간보호·단기보호·시설급여 이용. 본인부담률 재가 15%, 시설 20%.",
    monthlyAmount: null,
    amountKind: "varies",
    applyAt: "국민건강보험공단 지사 (등급 신청)",
    legalBasis: "노인장기요양보험법",
    source: "보건복지부 2026년 장기요양 급여비용 고시",
    verified: "confirmed",
    rules: [
      { field: "ltcGrade", op: "in", value: ["1", "2", "3", "4", "5", "cognitive"], describe: "장기요양 등급 판정을 받은 경우" },
    ],
    awareness: "high",
    beneficiary: "recipient",
    tags: ["장기요양", "핵심"],
  },
  {
    id: "family-care-allowance",
    name: "가족요양비 (특별현금급여)",
    authority: "국민건강보험공단",
    summary: "요양기관 이용이 어려운 지역에 살면 가족이 직접 돌봐도 현금을 받습니다.",
    plainSummary: "요양시설이 없는 시골에 사시면, 가족이 직접 돌봐도 매달 돈을 받습니다.",
    benefit: "월 240,450원 현금 지급 (2026년 기준).",
    monthlyAmount: 240_450,
    amountKind: "fixed",
    applyAt: "국민건강보험공단 지사",
    legalBasis: "노인장기요양보험법 제24조 (가족요양비)",
    source: "2026년 특별현금급여 고시",
    verified: "confirmed",
    caveat:
      "도서·벽지 등 장기요양기관이 현저히 부족한 지역 거주, 천재지변, 감염병 등 제한적 사유에만 해당합니다. 일반 지역에서는 대상이 아닙니다.",
    rules: [
      { field: "ltcGrade", op: "in", value: ["1", "2", "3", "4", "5"], describe: "장기요양 등급 보유" },
      { field: "remoteArea", op: "eq", value: true, describe: "장기요양기관이 현저히 부족한 지역 거주" },
    ],
    exclusiveWith: ["ltc-benefit"],
    awareness: "low",
    beneficiary: "caregiver",
    tags: ["현금급여", "놓치기쉬움"],
  },
  {
    id: "family-caregiver-cert",
    name: "가족인 요양보호사",
    authority: "국민건강보험공단",
    summary: "가족이 요양보호사 자격을 따고 재가센터에 소속되면, 부모를 돌보면서 급여를 받습니다.",
    plainSummary: "자격증을 따고 센터에 소속되면, 부모님을 돌보면서 월급을 받습니다.",
    benefit:
      "재가장기요양기관 소속으로 근로계약을 맺고 방문요양 급여를 제공하면 그에 따른 급여비용을 수령. 월 인정 시간에 제한이 있습니다.",
    monthlyAmount: null,
    amountKind: "varies",
    applyAt: "요양보호사 교육기관 → 자격 취득 → 재가장기요양기관 소속 → 공단 등록",
    legalBasis: "노인복지법 제39조의2 (요양보호사 자격), 노인장기요양보험법",
    source: "찾기쉬운 생활법령정보 — 가족인 요양보호사",
    verified: "confirmed",
    caveat:
      "반드시 재가노인복지센터(방문요양센터)에 소속되어 근로계약을 맺어야 하며, 공단에 '가족인 요양보호사'로 등록된 시점부터 급여가 산정됩니다. 등록 전 돌봄은 소급되지 않습니다.",
    rules: [
      { field: "ltcGrade", op: "in", value: ["1", "2", "3", "4", "5"], describe: "돌봄 대상자가 장기요양 등급 보유" },
      {
        field: "caregiverHasCareWorkerCert",
        op: "eq",
        value: true,
        describe: "돌보는 사람이 요양보호사 자격 보유",
      },
    ],
    requires: ["ltc-benefit"],
    awareness: "low",
    beneficiary: "caregiver",
    tags: ["소득", "자격", "놓치기쉬움"],
  },
  {
    id: "ltc-copay-reduction",
    name: "장기요양 본인부담금 감경",
    authority: "국민건강보험공단",
    summary: "소득·재산 기준을 충족하면 본인부담률이 15%에서 9% 또는 6%로 낮아집니다.",
    plainSummary: "형편이 어려우면 내야 할 돈이 절반 가까이 줄어듭니다.",
    benefit:
      "재가급여 본인부담률 15% → 9%(경감 40%) 또는 6%(경감 60%). 시설급여 20% → 12% 또는 8%. 기초생활수급자는 면제.",
    monthlyAmount: null,
    amountKind: "varies",
    valuation: { kind: "copayReduction" },
    applyAt: "국민건강보험공단 지사",
    legalBasis: "노인장기요양보험법 시행령",
    source: "국민건강보험공단 2026년 본인부담금 안내",
    verified: "confirmed",
    caveat: "소득·재산을 함께 보므로 공단에 직접 확인해야 정확합니다.",
    rules: [
      { field: "ltcGrade", op: "exists", value: true, describe: "장기요양 등급 보유" },
      { field: "incomePercentile", op: "lte", value: 50, describe: "소득·재산 기준 충족" },
    ],
    requires: ["ltc-benefit"],
    awareness: "medium",
    beneficiary: "recipient",
    tags: ["감면", "핵심"],
  },
  {
    id: "dementia-treatment-support",
    name: "치매치료관리비 지원",
    authority: "보건소 / 치매안심센터",
    summary: "치매 진단을 받고 약을 복용 중이면 진료비·약제비 본인부담금을 지원받습니다.",
    plainSummary: "치매 약값과 진료비를 매달 3만원까지 대신 내줍니다.",
    benefit: "월 3만원, 연 36만원 한도 내에서 보험급여분 본인부담금 지원.",
    monthlyAmount: 30_000,
    amountKind: "cap",
    applyAt: "주민등록 주소지 관할 보건소 · 치매안심센터 (방문·우편·팩스·이메일)",
    legalBasis: "치매관리법",
    source: "정부24 치매 치료관리비 지원 / 보건복지부 치매정책",
    verified: "confirmed",
    caveat:
      "소득 기준은 원칙적으로 기준 중위소득 120% 이하지만, 지자체별로 140%까지 확대했거나 소득과 무관하게 지원하는 곳도 있습니다. 거주지 보건소 확인이 필요합니다.",
    rules: [
      { field: "recipientAge", op: "gte", value: 60, describe: "만 60세 이상" },
      { field: "hasDementiaDiagnosis", op: "eq", value: true, describe: "의료기관에서 치매 진단 (F00~F03, G30 등) 후 치료약 복용 중" },
      { field: "incomePercentile", op: "lte", value: 120, describe: "기준 중위소득 120% 이하 (지자체별 완화)" },
    ],
    awareness: "low",
    beneficiary: "recipient",
    tags: ["치매", "의료비", "놓치기쉬움"],
  },
  {
    id: "family-care-leave",
    name: "가족돌봄휴직",
    authority: "고용노동부",
    summary: "가족을 돌보기 위해 연간 90일까지 무급 휴직할 수 있습니다. 퇴사 대신 쓸 수 있는 선택지입니다.",
    plainSummary: "회사를 그만두지 않고 1년에 90일까지 쉴 수 있습니다. 돈은 안 나옵니다.",
    benefit: "연간 90일 (가족돌봄휴가 포함). 분할 사용 시 1회 30일 이상.",
    monthlyAmount: null,
    amountKind: "in-kind",
    applyAt: "재직 중인 사업장 (사업주에게 신청)",
    legalBasis: "남녀고용평등과 일·가정 양립 지원에 관한 법률 제22조의2",
    source: "정부24 가족돌봄휴직 제도 / 찾기쉬운 생활법령정보",
    verified: "confirmed",
    caveat: "무급이 원칙입니다. 사업주는 정당한 사유 없이 거부할 수 없습니다.",
    rules: [
      { field: "caregiverEmployed", op: "eq", value: true, describe: "돌보는 사람이 재직 중" },
    ],
    awareness: "medium",
    beneficiary: "caregiver",
    tags: ["고용", "퇴사대안", "핵심"],
  },
  {
    id: "family-care-day-leave",
    name: "가족돌봄휴가",
    authority: "고용노동부",
    summary: "연간 10일까지 하루 단위(또는 시간 단위)로 쓸 수 있는 돌봄 휴가입니다.",
    plainSummary: "1년에 10일까지 하루씩 쉴 수 있습니다.",
    benefit: "연간 최대 10일. 가족돌봄휴직 90일에 포함. 시간 단위 사용 가능.",
    monthlyAmount: null,
    amountKind: "in-kind",
    applyAt: "재직 중인 사업장",
    legalBasis: "남녀고용평등법 제22조의2 제4항",
    source: "찾기쉬운 생활법령정보",
    verified: "needs-check",
    caveat:
      "법정 한도는 연 10일입니다. 2026년 확대 여부에 대한 상충되는 자료가 있어 시행 여부를 고용노동부에서 확인해야 합니다.",
    rules: [{ field: "caregiverEmployed", op: "eq", value: true, describe: "돌보는 사람이 재직 중" }],
    requires: [],
    awareness: "medium",
    beneficiary: "caregiver",
    tags: ["고용", "퇴사대안"],
  },
  {
    id: "family-care-work-reduction",
    name: "가족돌봄 등을 위한 근로시간 단축",
    authority: "고용노동부",
    summary: "퇴사하지 않고 근로시간만 줄이는 선택지입니다.",
    plainSummary: "회사를 그만두는 대신 근무 시간만 줄일 수 있습니다.",
    benefit: "주 15~30시간으로 단축. 최대 1년(연장 시 최대 3년).",
    monthlyAmount: null,
    amountKind: "in-kind",
    applyAt: "재직 중인 사업장",
    legalBasis: "남녀고용평등법 제22조의3",
    source: "찾기쉬운 생활법령정보",
    verified: "needs-check",
    caveat: "단축 기간·급여 지원 여부는 사유와 사업장 규모에 따라 다릅니다. 고용노동부 확인 필요.",
    rules: [{ field: "caregiverEmployed", op: "eq", value: true, describe: "돌보는 사람이 재직 중" }],
    awareness: "low",
    beneficiary: "caregiver",
    tags: ["고용", "퇴사대안", "놓치기쉬움"],
  },
  {
    id: "dementia-family-respite",
    name: "치매가족휴가제 (단기보호)",
    authority: "국민건강보험공단",
    summary: "돌보는 가족이 쉴 수 있도록 단기보호나 종일 방문요양을 연간 일정 일수 지원합니다.",
    plainSummary: "돌보는 가족이 쉴 수 있게, 며칠 동안 어르신을 맡아줍니다.",
    benefit: "연간 정해진 일수 내 단기보호 또는 24시간 방문요양 이용. 월 한도와 별도로 산정.",
    monthlyAmount: null,
    amountKind: "in-kind",
    applyAt: "국민건강보험공단 지사 · 장기요양기관",
    legalBasis: "노인장기요양보험법",
    source: "국민건강보험공단 장기요양 안내",
    verified: "needs-check",
    caveat: "연간 이용 가능 일수와 대상 등급이 해마다 조정됩니다. 2026년 기준 확인 필요.",
    rules: [
      { field: "hasDementiaDiagnosis", op: "eq", value: true, describe: "치매 진단" },
      { field: "ltcGrade", op: "exists", value: true, describe: "장기요양 등급 보유" },
    ],
    requires: ["ltc-benefit"],
    awareness: "low",
    beneficiary: "caregiver",
    tags: ["치매", "휴식", "놓치기쉬움"],
  },
  {
    id: "senior-customized-care",
    name: "노인맞춤돌봄서비스",
    authority: "보건복지부 / 시군구",
    summary: "장기요양 등급을 못 받은 어르신도 안전확인·생활교육·가사지원을 받을 수 있습니다.",
    plainSummary: "등급을 못 받아도 안부 확인과 집안일을 도와줍니다.",
    benefit: "안전지원, 사회참여, 생활교육, 일상생활 지원 등 (서비스 제공, 현금 아님).",
    monthlyAmount: null,
    amountKind: "in-kind",
    applyAt: "주민등록 주소지 행정복지센터",
    legalBasis: "노인복지법",
    source: "보건복지부 노인정책",
    verified: "needs-check",
    caveat: "장기요양 급여 수급자는 원칙적으로 중복 이용이 제한됩니다.",
    rules: [
      { field: "recipientAge", op: "gte", value: 65, describe: "만 65세 이상" },
      { field: "incomePercentile", op: "lte", value: 96, describe: "기준 중위소득 96% 이하 (2026 기초연금 선정기준액 기준)" },
    ],
    exclusiveWith: ["ltc-benefit"],
    awareness: "medium",
    beneficiary: "recipient",
    tags: ["등급외", "돌봄서비스"],
  },
  {
    id: "emergency-safety-service",
    name: "응급안전안심서비스",
    authority: "보건복지부",
    summary: "댁내 장비로 화재·활동 이상을 감지해 응급상황에 대응합니다. 원거리 가족에게 유용합니다.",
    plainSummary: "집에 장비를 달아 위급할 때 자동으로 알려줍니다. 멀리 사는 자녀에게 좋습니다.",
    benefit: "응급안전 장비 설치 및 24시간 모니터링 (무료).",
    monthlyAmount: null,
    amountKind: "in-kind",
    applyAt: "행정복지센터 · 지역센터",
    legalBasis: "노인복지법",
    source: "공공데이터포털 보건복지부 응급안전안심 서비스 대상자 기본정보",
    verified: "needs-check",
    caveat: "독거노인·조손가구 등 대상 요건이 있습니다.",
    rules: [
      { field: "recipientAge", op: "gte", value: 65, describe: "만 65세 이상" },
      { field: "livesAlone", op: "eq", value: true, describe: "독거 또는 조손가구" },
    ],
    awareness: "low",
    beneficiary: "both",
    tags: ["안전", "원거리돌봄", "놓치기쉬움"],
  },
  {
    id: "welfare-equipment",
    name: "복지용구 급여",
    authority: "국민건강보험공단",
    summary: "휠체어·전동침대·미끄럼방지용품 등을 연 한도 내에서 구입·대여할 수 있습니다.",
    plainSummary: "휠체어나 전동침대를 싸게 사거나 빌릴 수 있습니다.",
    benefit: "연간 한도액 내에서 구입 또는 대여. 본인부담률은 장기요양 급여와 동일 체계.",
    monthlyAmount: null,
    amountKind: "cap",
    valuation: { kind: "annualCap", annualLimit: 1_600_000 },
    applyAt: "국민건강보험공단 지사 · 복지용구 사업소",
    legalBasis: "노인장기요양보험법",
    source: "국민건강보험공단 장기요양 안내",
    verified: "needs-check",
    caveat: "2026년 연간 한도액 확인 필요.",
    rules: [
      { field: "ltcGrade", op: "exists", value: true, describe: "장기요양 등급 보유" },
      {
        field: "careSetting",
        op: "in",
        value: ["home", "family"],
        describe: "재가 이용 (시설 입소자는 시설에서 제공)",
      },
    ],
    requires: ["ltc-benefit"],
    awareness: "medium",
    beneficiary: "recipient",
    tags: ["현물", "장기요양"],
  },
  {
    id: "basic-pension",
    name: "기초연금",
    authority: "보건복지부 / 국민연금공단",
    summary: "만 65세 이상 소득 하위 70%에게 매월 지급됩니다. 부모 소득으로 잡히므로 돌봄 재무에 직접 영향을 줍니다.",
    plainSummary: "만 65세가 넘고 형편이 넉넉하지 않으면 매달 나오는 돈입니다.",
    benefit: "소득인정액 기준 하위 70%에게 월정액 지급.",
    monthlyAmount: 349_700,
    amountKind: "fixed",
    applyAt: "행정복지센터 · 국민연금공단 지사",
    legalBasis: "기초연금법",
    source: "보건복지부 2026년 기초연금 선정기준액·기준연금액",
    verified: "confirmed",
    caveat:
      "2026년 기준연금액 349,700원(단독가구 기준). 부부 동시 수급 시 각각 20% 감액됩니다. 소득인정액은 재산을 소득으로 환산해 합산하므로 공단 확인이 필요합니다.",
    rules: [
      { field: "recipientAge", op: "gte", value: 65, describe: "만 65세 이상" },
      { field: "incomePercentile", op: "lte", value: 96, describe: "기준 중위소득 96% 이하 (2026 기초연금 선정기준액 단독 247만원 ÷ 1인가구 중위소득 256만 4,238원)" },
    ],
    awareness: "high",
    beneficiary: "recipient",
    tags: ["소득", "연금"],
  },
  {
    id: "copay-annual-ceiling",
    name: "본인부담상한제",
    authority: "국민건강보험공단",
    summary: "1년간 건강보험 본인부담금이 소득분위별 상한액을 넘으면 초과분을 전액 돌려받습니다.",
    plainSummary: "1년 병원비가 일정 금액을 넘으면 넘은 만큼 돌려받습니다.",
    benefit:
      "2026년 상한액은 소득 1분위 90만원부터 10분위 843만원까지. 요양병원 120일 초과 입원 시 10분위 상한액은 1,096만원. 매년 8월 하순 정산 후 9월부터 순차 지급.",
    monthlyAmount: null,
    amountKind: "cap",
    applyAt: "국민건강보험공단 (안내문 수령 후 계좌 신청, 지급동의계좌 등록 시 자동)",
    legalBasis: "국민건강보험법 제44조 (본인일부부담금의 상한)",
    source: "국민건강보험공단 본인부담상한제 안내 (2026)",
    verified: "confirmed",
    caveat:
      "비급여·선별급여·상급병실료 등은 합산되지 않습니다. 요양병원 장기 입원은 상한액이 따로 올라갑니다. 사후 환급이라 당장 부담이 줄지는 않습니다.",
    rules: [{ field: "recipientAge", op: "gte", value: 0, describe: "건강보험 가입자·피부양자" }],
    awareness: "medium",
    beneficiary: "recipient",
    tags: ["의료비", "환급", "핵심"],
  },
  {
    id: "catastrophic-medical",
    name: "재난적 의료비 지원",
    authority: "국민건강보험공단",
    summary: "의료비 부담이 감당하기 어려운 수준이면 본인부담의 절반 이상을 지원받습니다.",
    plainSummary: "병원비가 감당이 안 될 때 절반 넘게 지원받습니다. 6개월 안에 신청해야 합니다.",
    benefit: "소득 구간에 따라 본인부담 의료비의 50~80% 지원. 연간 최대 5,000만원.",
    monthlyAmount: null,
    amountKind: "cap",
    applyAt: "국민건강보험공단 지사 (방문·우편·팩스)",
    legalBasis: "재난적의료비 지원에 관한 법률",
    source: "국민건강보험공단 재난적 의료비 지원제도 안내 (2026)",
    verified: "confirmed",
    caveat:
      "의료비 발생일로부터 180일 이내에 신청해야 합니다. 기한을 넘기면 지원받지 못합니다. 소득은 기준 중위소득 100% 이하가 원칙이고 가구원 수별 건강보험료로 판정합니다.",
    rules: [
      { field: "incomePercentile", op: "lte", value: 100, describe: "기준 중위소득 100% 이하" },
    ],
    awareness: "low",
    beneficiary: "recipient",
    tags: ["의료비", "긴급", "놓치기쉬움"],
  },
  {
    id: "medical-tax-deduction",
    name: "의료비 세액공제 (부양가족)",
    authority: "국세청",
    summary: "부모 의료비를 자녀가 부담하면 연말정산에서 세액공제를 받습니다.",
    plainSummary: "부모님 병원비를 내드렸으면 연말정산에서 세금을 돌려받습니다.",
    benefit:
      "총급여 3% 초과분에 대해 15% 세액공제. 만 65세 이상 부양가족 의료비는 공제 한도 없음.",
    monthlyAmount: null,
    amountKind: "varies",
    applyAt: "연말정산 (근무처) 또는 종합소득세 신고",
    legalBasis: "소득세법 제59조의4 (특별세액공제)",
    source: "국세청 연말정산 안내",
    verified: "needs-check",
    caveat:
      "공제율과 한도는 개정될 수 있습니다. 부모를 부양가족으로 등록했는지, 형제 중 누가 공제받는지에 따라 달라집니다. 국세청 기준으로 확인이 필요합니다.",
    rules: [
      { field: "caregiverEmployed", op: "eq", value: true, describe: "돌보는 사람이 소득이 있음" },
      { field: "recipientAge", op: "gte", value: 65, describe: "부양가족이 만 65세 이상" },
    ],
    awareness: "medium",
    beneficiary: "caregiver",
    tags: ["세제", "연말정산"],
  },
  {
    id: "emergency-welfare",
    name: "긴급복지지원",
    authority: "보건복지부 / 시군구",
    summary: "갑작스러운 위기로 생계가 곤란해지면 생계·의료비를 긴급히 지원합니다.",
    plainSummary: "갑자기 형편이 어려워졌을 때 급하게 생활비와 병원비를 줍니다.",
    benefit: "생계지원, 의료지원(회당 최대 한도), 주거지원 등. 선지원 후조사 원칙.",
    monthlyAmount: null,
    amountKind: "varies",
    applyAt: "행정복지센터 · 보건복지상담센터 129",
    legalBasis: "긴급복지지원법",
    source: "보건복지부 긴급복지지원 안내",
    verified: "needs-check",
    caveat:
      "주소득자의 사망·질병·실직 등 위기사유와 소득·재산 기준을 함께 봅니다. 지원 금액은 해마다 고시로 정해집니다.",
    rules: [{ field: "incomePercentile", op: "lte", value: 75, describe: "기준 중위소득 75% 이하" }],
    awareness: "low",
    beneficiary: "both",
    tags: ["긴급", "생계", "놓치기쉬움"],
  },
  {
    id: "dementia-public-guardian",
    name: "치매공공후견제도",
    authority: "보건복지부 / 치매안심센터",
    summary: "의사결정이 어려운데 돌볼 가족이 없는 치매 어르신에게 공공후견인을 연결합니다.",
    plainSummary: "돌볼 가족이 없는 치매 어르신께 나라가 후견인을 붙여줍니다.",
    benefit: "후견 심판 청구 비용과 후견인 활동비를 지원합니다.",
    monthlyAmount: null,
    amountKind: "in-kind",
    applyAt: "치매안심센터",
    legalBasis: "치매관리법 제12조의3",
    source: "보건복지부 치매정책",
    verified: "needs-check",
    caveat: "대상 요건(가족 유무, 소득 등)과 지원 범위는 지자체별로 다릅니다.",
    rules: [
      { field: "hasDementiaDiagnosis", op: "eq", value: true, describe: "치매 진단" },
      { field: "recipientAge", op: "gte", value: 60, describe: "만 60세 이상" },
      {
        field: "hasFamilySupport",
        op: "eq",
        value: false,
        describe: "의사결정을 도울 가족이 없음",
      },
    ],
    awareness: "low",
    beneficiary: "recipient",
    tags: ["치매", "후견", "놓치기쉬움"],
  },
  {
    id: "wandering-detector",
    name: "배회감지기 보급",
    authority: "치매안심센터 / 국민건강보험공단",
    summary: "실종 위험이 있는 어르신에게 위치 확인 기기를 지원합니다. 원거리 가족에게 특히 필요합니다.",
    plainSummary: "길을 잃을 위험이 있으면 위치를 알려주는 기계를 지원합니다.",
    benefit: "GPS 배회감지기 대여 또는 구입 지원. 장기요양 복지용구 급여로도 이용 가능.",
    monthlyAmount: null,
    amountKind: "in-kind",
    applyAt: "치매안심센터 · 국민건강보험공단 (복지용구)",
    legalBasis: "치매관리법 / 노인장기요양보험법",
    source: "보건복지부 치매정책",
    verified: "needs-check",
    caveat: "지자체 보급 물량과 복지용구 급여 한도가 별개로 적용됩니다.",
    rules: [{ field: "hasDementiaDiagnosis", op: "eq", value: true, describe: "치매 진단" }],
    awareness: "low",
    beneficiary: "both",
    tags: ["치매", "안전", "원거리돌봄", "놓치기쉬움"],
  },
  {
    id: "senior-job",
    name: "노인일자리 및 사회활동 지원",
    authority: "보건복지부 / 한국노인인력개발원",
    summary: "부모가 참여 가능한 상태면 소득이 생겨 돌봄 재무가 달라집니다.",
    plainSummary: "부모님이 일하실 수 있으면 활동비를 받는 일자리가 있습니다.",
    benefit: "공익활동형·사회서비스형 등 유형별 월 활동비 지급.",
    monthlyAmount: null,
    amountKind: "varies",
    applyAt: "행정복지센터 · 시니어클럽 · 노인복지관",
    legalBasis: "노인복지법",
    source: "보건복지부 노인정책",
    verified: "needs-check",
    caveat:
      "장기요양 등급을 받을 정도의 상태면 참여가 어렵습니다. 등급 판정 전 단계에서 검토할 항목입니다.",
    rules: [
      { field: "recipientAge", op: "gte", value: 65, describe: "만 65세 이상" },
      { field: "incomePercentile", op: "lte", value: 96, describe: "기준 중위소득 96% 이하 (2026 기초연금 선정기준액 기준)" },
    ],
    exclusiveWith: ["ltc-benefit"],
    awareness: "high",
    beneficiary: "recipient",
    tags: ["소득", "등급외"],
  },
  {
    id: "medical-aid",
    name: "의료급여",
    authority: "보건복지부 / 시군구",
    summary: "수급자로 선정되면 진료비 본인부담이 대폭 낮아집니다.",
    plainSummary: "수급자가 되면 병원비가 아주 적게 듭니다.",
    benefit: "1종·2종 구분에 따라 외래·입원 본인부담금이 정액 또는 소액으로 경감됩니다.",
    monthlyAmount: null,
    amountKind: "varies",
    applyAt: "행정복지센터",
    legalBasis: "의료급여법",
    source: "보건복지부 의료급여 안내",
    verified: "needs-check",
    caveat: "부양의무자 기준과 소득·재산 기준을 함께 봅니다. 지자체 확인이 필요합니다.",
    rules: [{ field: "incomePercentile", op: "lte", value: 40, describe: "기준 중위소득 40% 이하" }],
    awareness: "high",
    beneficiary: "recipient",
    tags: ["의료비", "수급"],
  },
];

/** 태그로 조회 */
export function programsByTag(tag: string): Program[] {
  return PROGRAMS.filter((p) => p.tags.includes(tag));
}

/** 놓치기 쉬운 제도 */
export function lowAwarenessPrograms(): Program[] {
  return PROGRAMS.filter((p) => p.awareness === "low");
}

/** 확인된 제도만 */
export function confirmedPrograms(): Program[] {
  return PROGRAMS.filter((p) => p.verified === "confirmed");
}

export function getProgram(id: string): Program | undefined {
  return PROGRAMS.find((p) => p.id === id);
}
