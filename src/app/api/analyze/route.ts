import { analyze, type AnalyzeInput } from "@/lib/engine/analyze";
import { getPreset } from "@/lib/presets";
import { validateAnalyzeInput } from "@/lib/engine/validate";

/**
 * 분석 실행.
 * 이 라우트에는 LLM이 개입하지 않는다. 전부 결정론적 계산이다.
 * 같은 입력이면 항상 같은 출력 — 감사 가능성의 전제.
 */
export async function POST(req: Request) {
  // 본문이 JSON 이 아닌 건 서버 오류가 아니라 요청 오류다.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "요청 본문이 JSON 형식이 아닙니다." }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return Response.json({ error: "요청 본문은 객체여야 합니다." }, { status: 400 });
  }
  const req_ = body as Record<string, unknown>;

  try {
    let input: AnalyzeInput;
    if (req_.presetId) {
      const preset = getPreset(String(req_.presetId));
      if (!preset) {
        return Response.json({ error: "존재하지 않는 프리셋입니다." }, { status: 400 });
      }
      input = preset.input;
    } else if (req_.input) {
      // 값의 형태를 먼저 본다. 말이 안 되는 입력에 그럴듯한 숫자를 주면 안 된다.
      const reason = validateAnalyzeInput(req_.input);
      if (reason) return Response.json({ error: reason }, { status: 400 });
      input = req_.input as AnalyzeInput;
    } else {
      return Response.json({ error: "presetId 또는 input이 필요합니다." }, { status: 400 });
    }

    const result = analyze(input);
    return Response.json({ ok: true, input, result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "분석 중 오류가 발생했습니다.";
    return Response.json({ error: message }, { status: 500 });
  }
}
