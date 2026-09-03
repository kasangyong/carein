"use client";

import { useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import Link from "next/link";
import { PRESETS } from "@/lib/presets";

/**
 * 채널 연계
 *
 * 은행 4곳이 2026년에 전부 시니어 금융으로 달려가고 있는데, 그들이 만든 것은
 * 신탁(자산가·사전가입)과 요양 정보 제공(기관 검색·비용 계산)에서 멈춘다.
 * 돌보는 자녀 본인의 재무를 계산해주는 채널은 없다.
 *
 * 이 페이지는 그 자리에 우리가 어떻게 들어가는지를 보여준다.
 */

const BANK_BRANDS = [
  {
    bank: "KB국민은행",
    brand: "KB골든라이프",
    have: "KB스타뱅킹 요양·돌봄 서비스 (기관 검색·비용 계산·등급 확인·상담)",
    gap: "요양 정보 제공에서 멈춤. 자녀 본인의 재무 영향은 계산하지 않음",
  },
  {
    bank: "하나은행",
    brand: "하나 더 넥스트",
    have: "치매안심금융센터, 유언대용신탁, 시니어 특화 라운지 전국 확대",
    gap: "신탁은 자산가가 건강할 때 가입하는 상품. 그 밖의 층은 대상이 아님",
  },
  {
    bank: "신한은행",
    brand: "SOL메이트",
    have: "치매·중증질환 시 사전 지정 신탁관리인이 병원비·요양비 집행",
    gap: "대상이 시니어 본인. 돌보는 자녀는 화면에 없음",
  },
  {
    bank: "생명보험사",
    brand: "요양·시니어케어",
    have: "프리미엄 요양원·실버타운 운영 (KB·신한·하나·삼성)",
    gap: "업계 스스로 \"고급은 늘고 중간은 없다\"고 진단. 중산층 문턱이 남음",
  },
];

export default function Partners() {
  const [preset, setPreset] = useState(PRESETS[0].id);
  const [tab, setTab] = useState<"widget" | "teller">("widget");

  return (
    <>
      <SiteHeader />

      <div className="shell" style={{ paddingTop: 44, paddingBottom: 90, display: "grid", gap: 36 }}>
        <div>
          <h1 style={{ fontSize: "clamp(23px, 3.4vw, 31px)", maxWidth: "23ch" }}>
            은행이 놓치고 있는 고객은 돌보는 자녀입니다
          </h1>
          <p style={{ marginTop: 14, maxWidth: "64ch", fontSize: 15, color: "var(--ink-2)" }}>
            돌보는 사람은 40~50대, 은행의 핵심 고객층입니다. 그런데 자산이 줄어드는 고객이라
            어느 채널에도 화면이 없습니다. 그 사이에 소리 없이 자산을 소진하고 경력을 잃습니다.
          </p>
        </div>

        <section>
          <h2 style={{ fontSize: 18, marginBottom: 5 }}>지금 각 채널이 가진 것과 빈 자리</h2>
          <p style={{ margin: "0 0 13px", fontSize: 13.5, color: "var(--ink-2)" }}>
            2026년 기준 공개된 서비스를 정리한 것입니다.
          </p>
          <div className="card scroll-x">
            <table className="data">
              <thead>
                <tr>
                  <th style={{ width: 118 }}>채널</th>
                  <th style={{ width: 128 }}>브랜드</th>
                  <th>가지고 있는 것</th>
                  <th>빈 자리</th>
                </tr>
              </thead>
              <tbody>
                {BANK_BRANDS.map((b) => (
                  <tr key={b.bank}>
                    <td style={{ fontWeight: 550, whiteSpace: "nowrap" }}>{b.bank}</td>
                    <td style={{ color: "var(--ink-2)", whiteSpace: "nowrap" }}>{b.brand}</td>
                    <td style={{ fontSize: 13 }}>{b.have}</td>
                    <td style={{ fontSize: 13, color: "var(--warn)" }}>{b.gap}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <div
            role="tablist"
            style={{ display: "flex", marginBottom: 16, borderBottom: "1px solid var(--line)" }}
          >
            {(
              [
                ["widget", "앱 임베드 위젯"],
                ["teller", "창구 상담사 모드"],
              ] as const
            ).map(([t, label]) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                style={{
                  border: 0,
                  background: "transparent",
                  padding: "8px 2px",
                  marginRight: 22,
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: tab === t ? 600 : 400,
                  color: tab === t ? "var(--ink)" : "var(--ink-3)",
                  borderBottom: tab === t ? "2px solid var(--primary)" : "2px solid transparent",
                  marginBottom: -1,
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "widget" && (
            <>
              <p style={{ margin: "0 0 14px", fontSize: 13.5, color: "var(--ink-2)", maxWidth: "64ch" }}>
                시니어 탭 안에 iframe 한 줄로 얹습니다. 아래는 실제로 동작하는 위젯이고, 은행 앱
                안에서 보이는 그대로입니다.
              </p>

              <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
                <div>
                  <div className="eyebrow" style={{ marginBottom: 7 }}>미리보기 (360 × 420)</div>
                  <div
                    style={{
                      width: 360,
                      height: 420,
                      border: "1px solid var(--line-strong)",
                      borderRadius: 6,
                      overflow: "hidden",
                      background: "var(--surface)",
                    }}
                  >
                    <iframe
                      key={preset}
                      src={`/widget?preset=${preset}`}
                      title="carein 위젯 미리보기"
                      style={{ width: "100%", height: "100%", border: 0 }}
                    />
                  </div>
                  <label style={{ display: "block", marginTop: 10 }}>
                    <span className="eyebrow" style={{ display: "block", marginBottom: 4 }}>
                      사례 바꾸기
                    </span>
                    <select
                      value={preset}
                      onChange={(e) => setPreset(e.target.value)}
                      style={{
                        border: "1px solid var(--line-strong)",
                        borderRadius: 2,
                        padding: "6px 9px",
                        fontSize: 13.5,
                        background: "var(--surface)",
                        color: "var(--ink)",
                      }}
                    >
                      {PRESETS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div style={{ flex: "1 1 320px", minWidth: 300 }}>
                  <div className="eyebrow" style={{ marginBottom: 7 }}>붙이는 방법</div>
                  <pre
                    className="num"
                    style={{
                      margin: 0,
                      padding: "12px 14px",
                      background: "var(--surface-sunk)",
                      border: "1px solid var(--line)",
                      borderRadius: 2,
                      fontSize: 12,
                      whiteSpace: "pre-wrap",
                    }}
                  >
{`<iframe
  src="https://carein.example/widget?preset=hospital"
  width="360" height="420" frameborder="0"
  title="돌봄 재무 점검"
></iframe>`}
                  </pre>
                  <p style={{ marginTop: 12, fontSize: 13, color: "var(--ink-2)" }}>
                    위젯은 계산 결과만 보여주고 개인정보를 받지 않습니다. 고객이 본인 상황을 넣는
                    단계에서 은행 앱을 벗어나지 않게 하려면 오픈 API로 직접 붙이는 방식이 낫습니다.
                  </p>
                  <Link
                    href="/developers"
                    style={{ fontSize: 13.5, display: "inline-block", marginTop: 4 }}
                  >
                    오픈 API 문서 보기
                  </Link>
                </div>
              </div>
            </>
          )}

          {tab === "teller" && (
            <>
              <p style={{ margin: "0 0 14px", fontSize: 13.5, color: "var(--ink-2)", maxWidth: "64ch" }}>
                창구 직원이 고객과 같은 화면을 보면서 함께 채우는 모드입니다. 고령 고객은 앱 설치와
                본인인증에서 대부분 이탈하기 때문에, 창구가 실질적인 진입점입니다.
              </p>
              <div className="card" style={{ padding: "16px 18px" }}>
                <p className="eyebrow" style={{ marginBottom: 10 }}>창구 모드가 달라지는 점</p>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.8 }}>
                  <li>
                    글씨 크기를 기본값부터 크게 시작합니다. 고객이 화면을 같이 봅니다.
                  </li>
                  <li>
                    직원이 대신 입력하므로 서류 판독을 먼저 씁니다. 등급판정 통지서를 스캔해 채웁니다.
                  </li>
                  <li>
                    결과에서 <strong>은행이 제안할 수 있는 것</strong>을 분리해 보여줍니다 — 주택연금,
                    신탁, 대출. 다만 제도로 해결되는 부분을 먼저 안내하고 상품은 그 다음입니다.
                  </li>
                  <li>
                    상담 요약을 인쇄용 한 장으로 뽑아 고객이 가져갈 수 있게 합니다.
                  </li>
                  <li>
                    개인정보를 저장하지 않으므로 상담 종료 시 화면을 닫으면 남는 것이 없습니다.
                  </li>
                </ul>
              </div>

              <div
                className="card"
                style={{
                  marginTop: 14,
                  padding: "13px 16px",
                  background: "var(--primary-soft)",
                  borderColor: "var(--primary)",
                }}
              >
                <p style={{ margin: 0, fontSize: 13.5 }}>
                  <strong>은행 입장의 수익 연결.</strong> 돌봄이 시작되면 부모 자산이 소진되고 주택만
                  남는 경우가 많습니다. 자산 소진 시점을 미리 알면 주택연금·신탁을 팔 시점도 알 수
                  있습니다. 다만 순서를 바꾸지 않습니다 — 제도로 줄일 수 있는 부담을 먼저 알려주고,
                  그 다음에 상품을 이야기합니다.
                </p>
              </div>
            </>
          )}
        </section>

        <section>
          <h2 style={{ fontSize: 18, marginBottom: 5 }}>망분리 환경</h2>
          <p style={{ margin: "0 0 13px", fontSize: 13.5, color: "var(--ink-2)", maxWidth: "66ch" }}>
            금융기관 내부망에서는 고객 데이터를 외부 API로 보낼 수 없습니다. 이 서비스는 제도 판정과
            금액 계산이 전부 결정론적 규칙이라, 모델을 내부망 소형 모델로 바꿔도 판정 결과가
            동일합니다. 판정이 모델 가중치 안에 있지 않기 때문입니다.
          </p>
          <div className="card" style={{ padding: "14px 17px" }}>
            <pre
              className="num"
              style={{
                margin: 0,
                fontSize: 12.5,
                whiteSpace: "pre-wrap",
                color: "var(--ink)",
              }}
            >
{`판정 = 지식베이스(제도 원문) + 룰엔진(계산)    ← 모델과 무관
LLM  = 문서 판독 + 설명 문장 생성               ← 교체 가능

  AI_PROVIDER=onprem
  ONPREM_BASE_URL=http://내부망-엔드포인트
  ONPREM_MODEL=...`}
            </pre>
          </div>
          <p style={{ marginTop: 11, fontSize: 13, color: "var(--ink-2)" }}>
            환경변수 한 줄로 전환되며, 어느 프로바이더를 쓰든 제도 판정과 금액은 같습니다.
            내부망 exaone3.5(7.8B)로 실제 대조해 자산 유지 기간·월 실부담·제도 판정·퇴사 손익이
            원 단위까지 일치하는 것을 확인했습니다. 파인튜닝한 모델은 판정이 가중치 안에 있어서
            이 주장을 할 수 없습니다.
          </p>
        </section>
      </div>
    </>
  );
}
