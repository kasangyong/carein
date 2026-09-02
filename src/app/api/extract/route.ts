import {
  getProvider,
  neutralizeInjection,
  type ProviderKind,
  type ExtractResult,
} from "@/lib/ai/provider";
import { mapExtractionToProfile } from "@/lib/engine/extract-map";

/**
 * 문서 판독. LLM이 개입하는 두 경로 중 하나.
 *
 * 판독 결과는 그대로 쓰지 않는다.
 *   1. 신뢰도 임계치 미달 필드는 "확인 필요"로 격리한다.
 *   2. 프로파일로 매핑할 때 허용된 값만 통과시킨다.
 *   3. 문서 안의 지시문은 데이터로 취급한다.
 */

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = ["image/png", "image/jpeg", "image/webp", "application/pdf"] as const;
type Allowed = (typeof ALLOWED)[number];

export async function POST(req: Request) {
  // 파일 업로드 전용 경로다. 다른 형식으로 오면 서버 오류가 아니라 요청 오류다.
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json(
      { error: "multipart/form-data 로 파일을 보내주세요." },
      { status: 415 },
    );
  }

  try {
    const file = form.get("file");
    const provider = (form.get("provider") as ProviderKind) || undefined;
    const docHint = (form.get("docHint") as string) || undefined;

    if (!(file instanceof File)) {
      return Response.json({ error: "파일이 없습니다." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return Response.json(
        { error: `파일이 너무 큽니다. ${Math.round(MAX_BYTES / 1024 / 1024)}MB 이하로 올려주세요.` },
        { status: 413 },
      );
    }
    if (!ALLOWED.includes(file.type as Allowed)) {
      return Response.json(
        { error: "PNG, JPEG, WebP, PDF만 읽을 수 있습니다." },
        { status: 415 },
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const data = buf.toString("base64");

    const p = getProvider(provider);
    const info = p.info();

    let extraction: ExtractResult;
    try {
      extraction = await p.extractDocument({
        data,
        mediaType: file.type as Allowed,
        docHint,
      });
    } catch (e) {
      return Response.json(
        {
          error:
            e instanceof Error && e.message.includes("ANTHROPIC_API_KEY")
              ? "문서 자동 판독을 쓰려면 모델 연결이 필요합니다. 값을 직접 입력해 주세요."
              : "문서를 읽지 못했습니다. 값을 직접 입력해 주세요.",
          provider: info,
        },
        { status: 502 },
      );
    }

    // 문서에 삽입된 지시문 흔적 검사 — 값이 아니라 공격이다
    const scan = neutralizeInjection(JSON.stringify(extraction.fields ?? {}));

    const mapped = mapExtractionToProfile(extraction);

    return Response.json({
      extraction,
      mapped: mapped.profile,
      lowConfidence: mapped.lowConfidence,
      rejected: mapped.rejected,
      provider: info,
      guardrails: {
        injectionsBlocked: scan.found,
        confidenceThreshold: mapped.threshold,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "문서 처리 중 오류가 발생했습니다.";
    return Response.json({ error: message }, { status: 500 });
  }
}
